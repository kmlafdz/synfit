// SYNFIT AI — PART 6C: BLUETOOTH SIG HEART RATE MEASUREMENT (0x2A37) PARSER
// Compliant with standard Bluetooth SIG specification for Heart Rate Service (0x180D)
// Verified with real Aolon GT Curve hardware tests (e.g. 06-45 -> 69 BPM, 06-46 -> 70 BPM)

import { HeartRateMeasurement } from "./types";

export const BLE_HEART_RATE_SERVICE_UUID = "0000180d-0000-1000-8000-00805f9b34fb";
export const BLE_HEART_RATE_MEASUREMENT_UUID = "00002a37-0000-1000-8000-00805f9b34fb";
export const BLE_CCC_DESCRIPTOR_UUID = "00002902-0000-1000-8000-00805f9b34fb";

/**
 * Parses raw BLE Heart Rate Measurement (0x2A37) payload according to Bluetooth SIG standard.
 *
 * Flag Byte Structure (Byte 0):
 * - Bit 0: Heart Rate Value Format (0 = UINT8, 1 = UINT16)
 * - Bit 1: Sensor Contact Detected (0 = Not Detected, 1 = Detected)
 * - Bit 2: Sensor Contact Supported (0 = Not Supported, 1 = Supported)
 * - Bit 3: Energy Expended Status (0 = Not Present, 1 = Present)
 * - Bit 4: RR-Interval (0 = Not Present, 1 = One or more RR-Intervals present)
 *
 * Example real payload from Aolon GT Curve:
 * - 06-45:
 *   - Flag 0x06 = 00000110b (UINT8, contact supported: true, contact detected: true)
 *   - BPM 0x45 = 69 BPM
 * - 06-46:
 *   - Flag 0x06 = 00000110b
 *   - BPM 0x46 = 70 BPM
 */
export function parseHeartRateMeasurement(dataView: DataView): HeartRateMeasurement {
  if (!dataView || dataView.byteLength < 2) {
    throw new Error("Invalid Heart Rate payload: minimum 2 bytes required");
  }

  const flags = dataView.getUint8(0);
  const is16Bit = (flags & 0x01) !== 0;
  let offset = 1;

  let bpm: number;
  if (is16Bit) {
    if (dataView.byteLength < offset + 2) {
      throw new Error("Payload too short for 16-bit Heart Rate value");
    }
    bpm = dataView.getUint16(offset, true); // Little-endian format as per BLE spec
    offset += 2;
  } else {
    bpm = dataView.getUint8(offset);
    offset += 1;
  }

  // Sensor Contact Feature (Bits 1 & 2)
  const sensorContactSupported = (flags & 0x04) !== 0;
  const sensorContactDetected = sensorContactSupported && (flags & 0x02) !== 0;

  // Energy Expended Field (Bit 3) — Unit: kiloJoules (kJ)
  const hasEnergyExpended = (flags & 0x08) !== 0;
  let energyExpended: number | undefined;
  if (hasEnergyExpended && dataView.byteLength >= offset + 2) {
    energyExpended = dataView.getUint16(offset, true);
    offset += 2;
  }

  // RR-Interval Field (Bit 4) — Units: 1/1024 seconds
  const hasRRInterval = (flags & 0x10) !== 0;
  const rrIntervals: number[] = [];
  if (hasRRInterval) {
    while (dataView.byteLength >= offset + 2) {
      const rawInterval = dataView.getUint16(offset, true);
      // Convert 1/1024s to approximate milliseconds (ms = raw * 1000 / 1024)
      const ms = Math.round((rawInterval * 1000) / 1024);
      rrIntervals.push(ms);
      offset += 2;
    }
  }

  return {
    bpm,
    sensorContactSupported,
    sensorContactDetected,
    energyExpended,
    rrIntervals: rrIntervals.length > 0 ? rrIntervals : undefined,
    timestamp: Date.now(),
  };
}

/**
 * Calculates session stats (min, max, average) strictly from valid received samples.
 * Bounded to realistic human heart rate range (30 - 240 BPM).
 */
export function calculateHeartRateStats(samples: { bpm: number }[]) {
  const validSamples = samples.filter((s) => typeof s.bpm === "number" && s.bpm >= 30 && s.bpm <= 240);

  if (validSamples.length === 0) {
    return {
      currentBpm: null,
      minBpm: null,
      maxBpm: null,
      avgBpm: null,
      totalSamples: 0,
    };
  }

  const bpms = validSamples.map((s) => s.bpm);
  const minBpm = Math.min(...bpms);
  const maxBpm = Math.max(...bpms);
  const sum = bpms.reduce((acc, val) => acc + val, 0);
  const avgBpm = Math.round(sum / bpms.length);

  return {
    currentBpm: bpms[bpms.length - 1],
    minBpm,
    maxBpm,
    avgBpm,
    totalSamples: validSamples.length,
  };
}

/**
 * Determines training heart rate zone based on BPM
 */
export function getHeartRateZone(bpm: number, maxBpmEstimate: number = 190): {
  zone: string;
  nameId: string;
  nameEn: string;
  color: string;
  bgColor: string;
} {
  const pct = (bpm / maxBpmEstimate) * 100;
  if (pct < 50) {
    return {
      zone: "Z0",
      nameId: "Istirahat",
      nameEn: "Resting",
      color: "text-blue-400",
      bgColor: "bg-blue-500/15 border-blue-500/25",
    };
  } else if (pct < 60) {
    return {
      zone: "Z1",
      nameId: "Pemanasan",
      nameEn: "Warm Up",
      color: "text-teal-400",
      bgColor: "bg-teal-500/15 border-teal-500/25",
    };
  } else if (pct < 70) {
    return {
      zone: "Z2",
      nameId: "Bakar Lemak",
      nameEn: "Fat Burn",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/15 border-emerald-500/25",
    };
  } else if (pct < 80) {
    return {
      zone: "Z3",
      nameId: "Kardio Aerobik",
      nameEn: "Aerobic",
      color: "text-amber-400",
      bgColor: "bg-amber-500/15 border-amber-500/25",
    };
  } else if (pct < 90) {
    return {
      zone: "Z4",
      nameId: "Ambang Anaerobik",
      nameEn: "Anaerobic",
      color: "text-orange-400",
      bgColor: "bg-orange-500/15 border-orange-500/25",
    };
  } else {
    return {
      zone: "Z5",
      nameId: "Puncak Maksimal",
      nameEn: "Maximum Peak",
      color: "text-red-400",
      bgColor: "bg-red-500/15 border-red-500/25",
    };
  }
}
