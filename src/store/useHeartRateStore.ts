"use client";

import { create } from "zustand";
import {
  BleConnectionStatus,
  HeartRateBleState,
  HeartRateSample,
  HeartRateSessionStats,
  BluetoothDevice,
  BluetoothRemoteGATTServer,
  BluetoothRemoteGATTCharacteristic,
} from "@/lib/bluetooth/types";
import {
  BLE_HEART_RATE_SERVICE_UUID,
  BLE_HEART_RATE_MEASUREMENT_UUID,
  parseHeartRateMeasurement,
  calculateHeartRateStats,
} from "@/lib/bluetooth/heartRateParser";
import { db } from "@/lib/firebase";
import { doc, setDoc, addDoc, collection } from "firebase/firestore";

const MAX_HISTORY_SAMPLES = 60; // Keep smooth chart with bounded memory
const STALE_THRESHOLD_MS = 8000; // 8s without packets = stale signal

// Module-level persistent Bluetooth entities (survive React component unmounts!)
let deviceInstance: BluetoothDevice | null = null;
let serverInstance: BluetoothRemoteGATTServer | null = null;
let characteristicInstance: BluetoothRemoteGATTCharacteristic | null = null;
let isConnecting = false;
let staleTimer: NodeJS.Timeout | null = null;
let autoSyncTimer: NodeJS.Timeout | null = null;
let lastSyncedSampleCount = 0;

interface HeartRateStoreState {
  status: BleConnectionStatus;
  deviceName: string;
  currentBpm: number | null;
  lastValidBpm: number | null;
  lastSampleTime: number | null;
  isStale: boolean;
  sensorContactSupported: boolean;
  sensorContactDetected: boolean;
  errorMessage: string | null;
  samples: HeartRateSample[];
  sessionStartTime: number | null;
  isSupported: boolean;
  stats: HeartRateSessionStats;
  memberId: string | null;

  // Actions
  setMemberId: (memberId: string | null) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  clearSession: () => void;
  syncToFirebase: (customMemberId?: string) => Promise<boolean>;
  getBleState: () => HeartRateBleState;
}

export const useHeartRateStore = create<HeartRateStoreState>((set, get) => ({
  status: "disconnected",
  deviceName: "Smartwatch",
  currentBpm: null,
  lastValidBpm: null,
  lastSampleTime: null,
  isStale: false,
  sensorContactSupported: false,
  sensorContactDetected: true,
  errorMessage: null,
  samples: [],
  sessionStartTime: null,
  isSupported: typeof window !== "undefined" && typeof navigator !== "undefined" && "bluetooth" in navigator,
  stats: {
    currentBpm: null,
    minBpm: null,
    maxBpm: null,
    avgBpm: null,
    totalSamples: 0,
    sessionStartTime: null,
  },
  memberId: null,

  setMemberId: (memberId) => {
    set({ memberId });
  },

  getBleState: () => {
    const s = get();
    return {
      status: s.status,
      deviceName: s.deviceName,
      currentBpm: s.currentBpm,
      lastValidBpm: s.lastValidBpm,
      lastSampleTime: s.lastSampleTime,
      isStale: s.isStale,
      sensorContactSupported: s.sensorContactSupported,
      sensorContactDetected: s.sensorContactDetected,
      errorMessage: s.errorMessage,
      samples: s.samples,
      stats: s.stats,
      isSupported: s.isSupported,
    };
  },

  connect: async () => {
    if (isConnecting) return;
    set({ errorMessage: null });

    if (typeof window === "undefined" || !navigator || !("bluetooth" in navigator)) {
      set({
        status: "error",
        errorMessage: "Browser ini belum mendukung Web Bluetooth. Gunakan Google Chrome pada Android/Desktop.",
      });
      return;
    }

    isConnecting = true;
    set({ status: "connecting" });

    try {
      // 1. Clean up stale connection if needed
      if (characteristicInstance) {
        try {
          characteristicInstance.removeEventListener("characteristicvaluechanged", handleNotification);
          characteristicInstance.stopNotifications().catch(() => {});
        } catch {}
        characteristicInstance = null;
      }
      if (deviceInstance?.gatt?.connected) {
        try {
          deviceInstance.gatt.disconnect();
        } catch {}
      }

      const navBluetooth = (navigator as any).bluetooth;

      // 2. Scan for any Bluetooth smartwatch or fitness tracker
      let device: BluetoothDevice;
      const bleServices = [
        "heart_rate",
        0x180d,
        BLE_HEART_RATE_SERVICE_UUID,
        "battery_service",
        0x180f,
        "generic_access",
        0x1800,
        "device_information",
        0x180a,
      ];

      try {
        // First try acceptAllDevices: true so all devices in range appear in Chrome's chooser
        device = await navBluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: bleServices,
        });
      } catch (filterErr: any) {
        if (filterErr.name === "NotFoundError") {
          // User cancelled the chooser modal
          set({ status: "disconnected" });
          isConnecting = false;
          return;
        }

        // Secondary fallback: filter by standard heart rate service and prefixes
        try {
          device = await navBluetooth.requestDevice({
            filters: [
              { services: ["heart_rate"] },
              { services: [0x180d] },
              { namePrefix: "Aolon" },
              { namePrefix: "Curve" },
              { namePrefix: "GT" },
              { namePrefix: "Watch" },
              { namePrefix: "Band" },
              { namePrefix: "Fit" },
              { namePrefix: "Smart" },
            ],
            optionalServices: bleServices,
          });
        } catch (subErr: any) {
          if (subErr.name === "NotFoundError") {
            set({ status: "disconnected" });
            isConnecting = false;
            return;
          }
          throw subErr;
        }
      }

      if (!device) {
        set({ status: "disconnected" });
        isConnecting = false;
        return;
      }

      deviceInstance = device;

      // Dynamically resolve device name
      let dynamicDeviceName = (device.name || "").trim();
      set({ deviceName: dynamicDeviceName || "Smartwatch" });

      // 3. Register disconnect listener
      device.addEventListener("gattserverdisconnected", handleDeviceDisconnected);

      // 4. Connect GATT Server
      if (!device.gatt) {
        throw new Error("GATT Server tidak tersedia pada perangkat");
      }

      const server = await device.gatt.connect();
      serverInstance = server;

      // If device.name was anonymous or empty, attempt reading Generic Access (0x2A00: Device Name)
      if (!dynamicDeviceName) {
        try {
          const gapService = await server.getPrimaryService("generic_access");
          const nameChar = await gapService.getCharacteristic("gap.device_name");
          const val = await nameChar.readValue();
          const decoded = new TextDecoder("utf-8").decode(val).trim();
          if (decoded) {
            dynamicDeviceName = decoded;
            set({ deviceName: decoded });
          }
        } catch {}
      }

      // If still empty, attempt Device Information (0x2A24: model_number_string)
      if (!dynamicDeviceName) {
        try {
          const infoService = await server.getPrimaryService("device_information");
          const modelChar = await infoService.getCharacteristic("model_number_string");
          const val = await modelChar.readValue();
          const decoded = new TextDecoder("utf-8").decode(val).trim();
          if (decoded) {
            dynamicDeviceName = decoded;
            set({ deviceName: decoded });
          }
        } catch {}
      }

      if (!dynamicDeviceName) {
        dynamicDeviceName = "Smartwatch BLE";
        set({ deviceName: dynamicDeviceName });
      }

      // 5. Get Primary Heart Rate Service
      let service;
      try {
        service = await server.getPrimaryService("heart_rate");
      } catch {
        service = await server.getPrimaryService(BLE_HEART_RATE_SERVICE_UUID);
      }

      // 6. Get Heart Rate Measurement Characteristic (0x2A37)
      let characteristic;
      try {
        characteristic = await service.getCharacteristic("heart_rate_measurement");
      } catch {
        characteristic = await service.getCharacteristic(BLE_HEART_RATE_MEASUREMENT_UUID);
      }

      characteristicInstance = characteristic;

      // 7. Start live notifications
      await characteristic.startNotifications();
      characteristic.addEventListener("characteristicvaluechanged", handleNotification);

      const now = Date.now();
      set({
        status: "connected",
        sessionStartTime: now,
        errorMessage: null,
      });

      // 8. Start Stale Signal Monitor
      if (staleTimer) clearInterval(staleTimer);
      staleTimer = setInterval(() => {
        const state = useHeartRateStore.getState();
        if (state.status !== "connected") return;
        if (state.lastSampleTime) {
          const elapsed = Date.now() - state.lastSampleTime;
          if (elapsed > STALE_THRESHOLD_MS && !state.isStale) {
            set({ isStale: true });
          } else if (elapsed <= STALE_THRESHOLD_MS && state.isStale) {
            set({ isStale: false });
          }
        }
      }, 1500);

      // 9. Start Auto-Sync to Database every 30 seconds
      if (autoSyncTimer) clearInterval(autoSyncTimer);
      autoSyncTimer = setInterval(() => {
        const state = useHeartRateStore.getState();
        if (state.status === "connected" && state.samples.length > lastSyncedSampleCount) {
          state.syncToFirebase().catch(() => {});
        }
      }, 30000);
    } catch (err: any) {
      console.error("[BLE HR Store] Connection error:", err);
      if (err.name === "NotFoundError") {
        set({ status: "disconnected" });
      } else {
        set({
          status: "error",
          errorMessage:
            err.message ||
            "Gagal menghubungkan ke smartwatch. Pastikan Bluetooth aktif dan jam tidak terhubung ke aplikasi Da Fit.",
        });
      }
    } finally {
      isConnecting = false;
    }
  },

  disconnect: () => {
    if (staleTimer) {
      clearInterval(staleTimer);
      staleTimer = null;
    }
    if (autoSyncTimer) {
      clearInterval(autoSyncTimer);
      autoSyncTimer = null;
    }

    if (characteristicInstance) {
      try {
        characteristicInstance.removeEventListener("characteristicvaluechanged", handleNotification);
        characteristicInstance.stopNotifications().catch(() => {});
      } catch {}
      characteristicInstance = null;
    }

    if (deviceInstance) {
      try {
        deviceInstance.removeEventListener("gattserverdisconnected", handleDeviceDisconnected);
        if (deviceInstance.gatt && deviceInstance.gatt.connected) {
          deviceInstance.gatt.disconnect();
        }
      } catch {}
      deviceInstance = null;
    }

    serverInstance = null;
    isConnecting = false;

    // Trigger final session sync on manual disconnect
    const state = useHeartRateStore.getState();
    if (state.samples.length > 0) {
      state.syncToFirebase().catch(() => {});
    }

    set({
      status: "disconnected",
      currentBpm: null,
      isStale: false,
    });
  },

  clearSession: () => {
    set({
      samples: [],
      currentBpm: null,
      lastSampleTime: null,
      isStale: false,
      sessionStartTime: Date.now(),
      stats: {
        currentBpm: null,
        minBpm: null,
        maxBpm: null,
        avgBpm: null,
        totalSamples: 0,
        sessionStartTime: Date.now(),
      },
    });
    lastSyncedSampleCount = 0;
  },

  syncToFirebase: async (customMemberId) => {
    const state = useHeartRateStore.getState();
    const targetMemberId = customMemberId || state.memberId;
    if (!targetMemberId || state.samples.length === 0) return false;

    try {
      const nowIso = new Date().toISOString();
      const currentStats = state.stats;

      // 1. Update member biometrics document (Latest real-time biometrics for AI to read!)
      const biometricsRef = doc(db, "member_biometrics", targetMemberId);
      await setDoc(
        biometricsRef,
        {
          member_id: targetMemberId,
          smartwatch_device: state.deviceName,
          last_heart_rate: state.currentBpm || state.lastValidBpm,
          avg_heart_rate: currentStats.avgBpm,
          peak_heart_rate: currentStats.maxBpm,
          min_heart_rate: currentStats.minBpm,
          total_samples_recorded: currentStats.totalSamples,
          last_heart_rate_sync: nowIso,
          cardio_zone: currentStats.avgBpm
            ? currentStats.avgBpm < 100
              ? "Warm Up"
              : currentStats.avgBpm < 130
              ? "Fat Burn"
              : currentStats.avgBpm < 160
              ? "Aerobic"
              : "Anaerobic"
            : null,
        },
        { merge: true }
      );

      // 2. Append to smartwatch_sessions history
      await addDoc(collection(db, "smartwatch_sessions"), {
        member_id: targetMemberId,
        device_name: state.deviceName,
        started_at: state.sessionStartTime ? new Date(state.sessionStartTime).toISOString() : nowIso,
        recorded_at: nowIso,
        avg_bpm: currentStats.avgBpm,
        max_bpm: currentStats.maxBpm,
        min_bpm: currentStats.minBpm,
        total_samples: currentStats.totalSamples,
        recent_samples: state.samples.slice(-20),
      });

      lastSyncedSampleCount = state.samples.length;
      return true;
    } catch (e) {
      console.warn("[BLE HR Store] Firebase sync warning:", e);
      return false;
    }
  },
}));

// Helper: Handle Notification Event from BLE Characteristic
function handleNotification(event: Event) {
  const target = event.target as unknown as { value?: DataView };
  if (!target || !target.value) return;

  try {
    const measurement = parseHeartRateMeasurement(target.value);
    const now = Date.now();
    const timeStr = new Date(now).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    useHeartRateStore.setState((prev) => {
      const nextSample: HeartRateSample = {
        time: timeStr,
        timestamp: now,
        bpm: measurement.bpm,
        contactDetected: measurement.sensorContactDetected,
      };

      const updatedSamples = [...prev.samples, nextSample];
      const boundedSamples =
        updatedSamples.length > MAX_HISTORY_SAMPLES
          ? updatedSamples.slice(updatedSamples.length - MAX_HISTORY_SAMPLES)
          : updatedSamples;

      const stats: HeartRateSessionStats = {
        ...calculateHeartRateStats(boundedSamples),
        sessionStartTime: prev.sessionStartTime || now,
      };

      return {
        currentBpm: measurement.bpm,
        lastValidBpm: measurement.bpm,
        lastSampleTime: now,
        isStale: false,
        sensorContactSupported: measurement.sensorContactSupported,
        sensorContactDetected: measurement.sensorContactDetected,
        samples: boundedSamples,
        stats,
      };
    });
  } catch (err: any) {
    console.warn("[BLE HR Store] Packet decode warning:", err.message);
  }
}

// Helper: Handle unexpected disconnection
function handleDeviceDisconnected() {
  useHeartRateStore.setState({
    status: "disconnected",
    currentBpm: null,
    isStale: false,
  });
  serverInstance = null;
  characteristicInstance = null;
}
