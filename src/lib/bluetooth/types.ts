// SYNFIT AI — PART 6C: SMARTWATCH HEART RATE TYPES & WEB BLUETOOTH DEFINITIONS

export type BleConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export interface HeartRateMeasurement {
  bpm: number;
  sensorContactSupported: boolean;
  sensorContactDetected: boolean;
  energyExpended?: number; // kiloJoules (kJ)
  rrIntervals?: number[]; // milliseconds / 1/1024s intervals
  timestamp: number;
}

export interface HeartRateSample {
  time: string; // Formatted HH:mm:ss
  timestamp: number; // Unix ms
  bpm: number;
  contactDetected?: boolean;
}

export interface HeartRateSessionStats {
  currentBpm: number | null;
  minBpm: number | null;
  maxBpm: number | null;
  avgBpm: number | null;
  totalSamples: number;
  sessionStartTime: number | null;
}

export interface HeartRateBleState {
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
  stats: HeartRateSessionStats;
  isSupported: boolean;
}

// ── Web Bluetooth API Type Definitions (Standard W3C Web Bluetooth) ──

export interface BluetoothDevice extends EventTarget {
  id: string;
  name?: string;
  gatt?: BluetoothRemoteGATTServer;
  addEventListener(type: "gattserverdisconnected", listener: (this: this, ev: Event) => any): void;
  removeEventListener(type: "gattserverdisconnected", listener: (this: this, ev: Event) => any): void;
}

export interface BluetoothRemoteGATTServer {
  device: BluetoothDevice;
  connected: boolean;
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: string | number): Promise<BluetoothRemoteGATTService>;
  getPrimaryServices(service?: string | number): Promise<BluetoothRemoteGATTService[]>;
}

export interface BluetoothRemoteGATTService {
  device: BluetoothDevice;
  uuid: string;
  isPrimary: boolean;
  getCharacteristic(characteristic: string | number): Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics(characteristic?: string | number): Promise<BluetoothRemoteGATTCharacteristic[]>;
}

export interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  service: BluetoothRemoteGATTService;
  uuid: string;
  value?: DataView;
  readValue(): Promise<DataView>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
  addEventListener(type: "characteristicvaluechanged", listener: (this: this, ev: Event) => any): void;
  removeEventListener(type: "characteristicvaluechanged", listener: (this: this, ev: Event) => any): void;
}

export interface BluetoothRequestDeviceFilter {
  services?: (string | number)[];
  name?: string;
  namePrefix?: string;
  manufacturerData?: { companyIdentifier: number; dataPrefix?: BufferSource; mask?: BufferSource }[];
  serviceData?: { service: string | number; dataPrefix?: BufferSource; mask?: BufferSource }[];
}

export interface RequestDeviceOptions {
  filters?: BluetoothRequestDeviceFilter[];
  optionalServices?: (string | number)[];
  acceptAllDevices?: boolean;
}

export interface NavigatorBluetooth {
  requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
  getAvailability?(): Promise<boolean>;
}
