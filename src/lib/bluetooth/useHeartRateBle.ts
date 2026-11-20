"use client";

import { useHeartRateStore } from "@/store/useHeartRateStore";
import { HeartRateBleState } from "./types";

/**
 * useHeartRateBle
 * 
 * Persistent Bluetooth Heart Rate Hook.
 * Backed by global `useHeartRateStore` singleton so switching tabs, 
 * opening modals, or navigating pages does NOT disconnect the smartwatch.
 */
export function useHeartRateBle() {
  const status = useHeartRateStore((s) => s.status);
  const deviceName = useHeartRateStore((s) => s.deviceName);
  const currentBpm = useHeartRateStore((s) => s.currentBpm);
  const lastValidBpm = useHeartRateStore((s) => s.lastValidBpm);
  const lastSampleTime = useHeartRateStore((s) => s.lastSampleTime);
  const isStale = useHeartRateStore((s) => s.isStale);
  const sensorContactSupported = useHeartRateStore((s) => s.sensorContactSupported);
  const sensorContactDetected = useHeartRateStore((s) => s.sensorContactDetected);
  const errorMessage = useHeartRateStore((s) => s.errorMessage);
  const samples = useHeartRateStore((s) => s.samples);
  const stats = useHeartRateStore((s) => s.stats);
  const isSupported = useHeartRateStore((s) => s.isSupported);

  const connect = useHeartRateStore((s) => s.connect);
  const disconnect = useHeartRateStore((s) => s.disconnect);
  const clearSession = useHeartRateStore((s) => s.clearSession);
  const syncToFirebase = useHeartRateStore((s) => s.syncToFirebase);

  const state: HeartRateBleState = {
    status,
    deviceName,
    currentBpm,
    lastValidBpm,
    lastSampleTime,
    isStale,
    sensorContactSupported,
    sensorContactDetected,
    errorMessage,
    samples,
    stats,
    isSupported,
  };

  return {
    state,
    connect,
    disconnect,
    clearSession,
    syncToFirebase,
  };
}
