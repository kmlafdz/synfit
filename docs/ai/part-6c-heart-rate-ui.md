# SYNFIT AI — PART 6C: SMARTWATCH HEART RATE UI INTEGRATION REPORT

**Document ID:** `SYNFIT-AI-PART-6C-HEART-RATE-UI`  
**Date:** 2026-10-20  
**Status:** IMPLEMENTED & VERIFIED (Regression Suite Passed: 16/16 & 10/10)  
**Target Hardware:** Aolon GT Curve (Bluetooth SIG Standard Heart Rate Service `0x180D`, Characteristic `0x2A37`)  

---

## 1. Executive Summary

Bagian Part 6C mengintegrasikan pembacaan detak jantung (*Heart Rate*) real-time dari smartwatch **Aolon GT Curve** secara langsung ke dalam halaman **AI Form Coach SynFit**.

Integrasi ini menyatu sebagai komponen informasi di dalam AI Form Coach tanpa membuat menu/halaman terpisah, tanpa membangun ulang arsitektur AI Form Coach, dan tanpa merusak analisis biomekanik berbasis kamera MediaPipe yang sudah ada.

### Prinsip Utama yang Dipenuhi:
1. **Bukan Menu Terpisah**: Heart Rate hadir sebagai modul biometrik terpadu di dalam tab AI Coach.
2. **Kamera Mandiri**: Kamera dan MediaPipe **tidak otomatis menyala** saat AI Coach dibuka; pembacaan BPM smartwatch dapat berjalan kapan saja baik kamera hidup maupun mati.
3. **Pemisahan Kegagalan (Fault-Isolation)**: Jika smartwatch terputus atau tidak tersedia, AI Form Coach tetap berfungsi 100% normal.
4. **Data Aktual Tanpa Sintetis**: Grafik Recharts dan ringkasan BPM (Min, Max, Avg) strictly dihitung dari notifikasi BLE aktual yang diterima. Jika belum ada sampel, antarmuka menampilkan status menunggu tanpa angka dummy.
5. **Kepatuhan Standar Bluetooth SIG**: Parsing payload mengikuti flag pada karakteristik `0x2A37` (mendukung 8-bit, 16-bit, sensor contact, energy expended, dan interval RR).

---

## 2. File yang Dibuat dan Diubah

| File | Status | Deskripsi |
|---|---|---|
| [`src/lib/bluetooth/types.ts`](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/src/lib/bluetooth/types.ts) | **Baru** | Definisi TypeScript untuk `HeartRateMeasurement`, `HeartRateSample`, `HeartRateSessionStats`, `BleConnectionStatus`, dan antarmuka Web Bluetooth W3C. |
| [`src/lib/bluetooth/heartRateParser.ts`](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/src/lib/bluetooth/heartRateParser.ts) | **Baru** | Parser spesifikasi Bluetooth SIG Heart Rate Measurement (`0x2A37`), penghitung statistik sesi, dan penentu zona kardio (Z1–Z5). |
| [`src/lib/bluetooth/useHeartRateBle.ts`](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/src/lib/bluetooth/useHeartRateBle.ts) | **Baru** | Custom React hook untuk manajemen koneksi BLE, subscription notifikasi, buffer memori terbatas (maks 40 sampel), deteksi data basi (*stale data*), dan pembersihan listener saat unmount. |
| [`src/components/SmartwatchHeartRate.tsx`](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/src/components/SmartwatchHeartRate.tsx) | **Baru** | Komponen UI Heart Rate: BPM utama, visualisasi denyut pulsing, grafik perubahan BPM aktual (Recharts), kartu ringkasan Min/Max/Avg, status kontak sensor, dan kontrol koneksi. Termasuk mode `compact` untuk overlay kamera. |
| [`src/components/AIFormCoach.tsx`](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/src/components/AIFormCoach.tsx) | **Diubah** | Integrasi modul Heart Rate ke halaman AI Form Coach: modul utama pada langkah pemilihan latihan (`choose_exercise`), badge live di viewport kamera (`preparation` & `workout`), bar BPM pada HUD bawah latihan, dan rekap kardio pada ringkasan sesi (`summary`). |
| [`scripts/test-part6c-heart-rate.mjs`](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/scripts/test-part6c-heart-rate.mjs) | **Baru** | Unit test suite memverifikasi parsing payload nyata Aolon GT Curve (`06-45` -> 69 BPM, `06-46` -> 70 BPM), 16-bit BPM, deteksi stale, statistik, dan independensi kamera. |

---

## 3. Cara Kerja Integrasi BLE

### A. Protokol dan UUID Standar
Menggunakan UUID standar Bluetooth SIG yang telah teruji pada nRF Connect dan hardware nyata:
- **Heart Rate Service**: `0000180d-0000-1000-8000-00805f9b34fb` (Short: `0x180D`)
- **Heart Rate Measurement**: `00002a37-0000-1000-8000-00805f9b34fb` (Short: `0x2A37`)
- **Client Characteristic Configuration (CCC)**: `00002902-0000-1000-8000-00805f9b34fb` (Short: `0x2902`)

### B. Format Payload Bluetooth SIG (Karakteristik `0x2A37`)
Struktur Byte Flags (Byte 0):
- **Bit 0**: Format BPM (`0` = UINT8 / 1 byte, `1` = UINT16 / 2 byte Little-Endian).
- **Bit 1 & 2**: Status Kontak Sensor (`Bit 2 = 1`: Sensor contact didukung; `Bit 1 = 1`: Sensor mendeteksi kontak kulit pergelangan tangan).
- **Bit 3**: Energy Expended (`1` = UINT16 kiloJoules field ada).
- **Bit 4**: RR-Interval (`1` = Satu atau lebih interval 1/1024s ada).

**Verifikasi Data Nyata Aolon GT Curve:**
- Payload `06-45`:
  - Flags: `0x06` (`00000110b`) -> Bit 0 = 0 (UINT8), Bit 1 = 1 (kontak kulit terdeteksi), Bit 2 = 1 (fitur kontak didukung).
  - Byte 1: `0x45` (heksadesimal) = **69 BPM**.
- Payload `06-46`:
  - Flags: `0x06` -> Bit 0 = 0 (UINT8), kontak terdeteksi.
  - Byte 1: `0x46` = **70 BPM**.

### C. Alur Koneksi & Keamanan
1. **Pemindaian & Pairing**: Web Bluetooth `navigator.bluetooth.requestDevice` memfilter layanan `heart_rate` / `0x180D` atau awalan nama `Aolon`, `GT`, `Curve`.
2. **Subscription Notifikasi**: Menghubungi GATT Server, mengambil primary service `0x180D`, characteristic `0x2A37`, dan memanggil `characteristic.startNotifications()`.
3. **Pembersihan Listener**: Saat disconnect atau unmount komponen, listener `characteristicvaluechanged` dan `gattserverdisconnected` dicopot, `stopNotifications()` dipanggil, dan `device.gatt.disconnect()` dieksekusi untuk mencegah kebocoran memori atau koneksi gantung.

---

## 4. Komponen UI yang Ditambahkan

### A. Modul Heart Rate Utama (Halaman AI Coach)
- **Tampilan BPM Besar**: Angka font mono tebal berukuran besar (`text-5xl` s/d `text-6xl`) dengan label `BPM` dan subtitle detak jantung.
- **Ikon Denyut Animasi**: Jantung merah pulsing yang berdetak dinamis sesuai irama BPM pengguna (`Math.max(0.4, 60 / bpm)`).
- **Badge Zona Kardio**: Indikator 5 segmen (Z1 Pemanasan, Z2 Bakar Lemak, Z3 Kardio Aerobik, Z4 Ambang Batas, Z5 Puncak Maksimal).
- **Status Perangkat & Kontak Kulit**: Label `Aolon GT Curve`, badge `Bluetooth LE`, dan chip status kontak kulit ("Kontak Kulit Terdeteksi" vs "Sensor Lepas dari Kulit").

### B. Grafik Detak Jantung Aktual (Recharts)
- Komponen `AreaChart` responsif dengan warna gradien ember/oranye SynFit.
- Sumbu X menampilkan waktu penerimaan sampel (`HH:mm:ss`), sumbu Y disesuaikan dengan rentang BPM aktual.
- Buffer memori dibatasi hingga maksimum **40 sampel** terakhir untuk menjaga performa rendering 60 FPS di perangkat mobile.
- **Zero Synthetic Data**: Jika belum ada data, grafik menampilkan placeholder informatif bahwa grafik akan terisi secara bertahap dari notifikasi aktual.

### C. Ringkasan Sesi (4 Bento Cards)
- **BPM Terkini**: Menampilkan nilai real-time saat terhubung, atau label status terputus.
- **BPM Minimum**: Nilai terendah yang tercatat selama sesi aktif.
- **BPM Maksimum**: Puncak detak jantung tertinggi selama sesi aktif.
- **BPM Rata-Rata**: Rata-rata matematis terhitung dari seluruh sampel valid (30–240 BPM).

### D. Penanganan Kualitas Data & Stale Signal
- **Stale Detection**: Timer otomatis memantau selisih waktu (`Date.now() - lastSampleTime`). Jika tidak ada transmisi baru > 8 detik, data ditandai sebagai **Sinyal Tertunda (Stale)** dengan warna kuning amber.
- **Pembedaan Disconnected**: Saat smartwatch terputus, BPM real-time disetel ke `null` (`--`), sedangkan nilai pembacaan terakhir diberi label terpisah sebagai "BPM Terakhir (Tersimpan)" agar pengguna tidak tertipu mengira angka lama adalah detak jantung saat ini.

### E. Integrasi Live HUD pada Kamera (Preparation & Workout)
- Pada header kontrol kamera di atas preview video (bersebelahan dengan status set dan fase latihan), terdapat compact badge detak jantung live dengan ikon jantung berdenyut dan angka BPM real-time.
- Pada up-layer bawah saat set latihan berjalan, terdapat kartu biometrik detak jantung live bersebelahan dengan rep counter dan Form Score.
- Pada akhir sesi latihan (langkah `summary`), jika terdapat sampel detak jantung yang terekam, ditampilkan kartu **Biometrik Kardio Sesi** yang mencantumkan Average BPM, Peak BPM, dan Min BPM selama latihan.

---

## 5. Hasil Pengujian & Verifikasi

### A. Unit Test Suite Part 6C (`scripts/test-part6c-heart-rate.mjs`)
Dijalankan via Node.js dengan 16 skenario pengujian komprehensif:

```text
==================================================================
  SYNFIT AI — PART 6C: HEART RATE BLE & UI VERIFICATION SUITE
==================================================================

--- 1. REAL HARDWARE PAYLOAD DECODING (Aolon GT Curve) ---
  [PASS] Payload 06-45 correctly yields 69 BPM with wrist contact active
  [PASS] Payload 06-46 correctly yields 70 BPM with wrist contact active
  [PASS] Sensor contact unsupported flag (flags = 0x00)
  [PASS] Sensor contact supported but NO contact detected (flags = 0x04)

--- 2. 16-BIT BPM & EXTENDED BLUETOOTH SIG FIELDS ---
  [PASS] 16-bit Heart Rate value (flag bit 0 = 1, little-endian)
  [PASS] Payload with Energy Expended (kJ) field
  [PASS] Payload with RR-Intervals
  [PASS] Malformed payloads throw informative errors

--- 3. SESSION STATS CALCULATION (MIN, MAX, AVG) ---
  [PASS] Empty samples returns null values without misleading defaults
  [PASS] Single sample calculates identical min, max, avg
  [PASS] Multiple samples calculate accurate min, max, and rounded average
  [PASS] Outlier filtering rejects impossible biometric values (<30 or >240 BPM)

--- 4. STALE DETECTION & DISCONNECTION BEHAVIOR ---
  [PASS] Data freshness: marks stale when elapsed time exceeds 8000ms threshold
  [PASS] Disconnection state preserves last valid reading but clears live real-time BPM

--- 5. AI FORM COACH INDEPENDENT OPERATION ---
  [PASS] Form Coach camera is not automatically activated on load
  [PASS] Smartwatch disconnection does not interrupt MediaPipe camera or rep counter

==================================================================
  TEST RESULTS: 16/16 TESTS PASSED (100% SUCCESS)
==================================================================
```

### B. Regression Test Suite Part 4B (`scripts/test-part4b-coach.mjs`)
Memverifikasi bahwa integrasi Heart Rate tidak merusak siklus rep counter, deteksi landmark, anti-double counting, atau keamanan API AI Form Coach:

```text
========================================================================
TOTAL SCENARIOS: 10 | PASSED: 10 | FAILED: 0 (100% SUCCESS)
========================================================================
```

### C. TypeScript Compilation Check (`tsc --noEmit`)
Hasil: **Exit Code 0** (Zero errors). Seluruh tipe Bluetooth W3C didefinisikan secara mandiri tanpa dependensi `@types/web-bluetooth` eksternal.

---

## 6. Hasil Pengujian pada Perangkat Fisik (Hardware Notes)

- **Aolon GT Curve**: Karakteristik notifikasi `0x2A37` terbukti aktif saat sensor optik jam menyentuh pergelangan tangan pengguna.
- **Catatan Da Fit**: Smartwatch Aolon GT Curve menggunakan chip BLE yang umumnya hanya mengizinkan 1 koneksi GATT aktif pada satu waktu. Jika jam tangan sedang terhubung ke aplikasi Da Fit di latar belakang smartphone, Web Bluetooth pada browser/Capacitor mungkin tidak dapat menemukan atau mengikat karakteristik `0x2A37`. Pengguna disarankan memutuskan sambungan sementara dari Da Fit atau mematikan sinkronisasi latar belakang Da Fit sebelum menghubungkan ke SynFit.

---

## 7. Kendala & Pekerjaan Mendatang

1. **Kompatibilitas Browser**:
   - Web Bluetooth API didukung secara penuh pada Google Chrome / Microsoft Edge (Android, Windows, macOS, ChromeOS).
   - Safari di iOS dan Firefox belum mendukung Web Bluetooth API standar. Untuk platform iOS atau lingkungan tanpa Web Bluetooth, disarankan memanfaatkan plugin Capacitor BLE native di build rilis Android/iOS berikutnya.
2. **Sinkronisasi Multi-Sensori Lanjutan (Future Part 6D)**:
   - Menghubungkan lonjakan detak jantung dengan penurunan Form Score (fatigue correlation) untuk memberikan rekomendasi otomatis waktu istirahat antar set.

---
*Laporan Part 6C selesai. Implementasi siap ditinjau.*
