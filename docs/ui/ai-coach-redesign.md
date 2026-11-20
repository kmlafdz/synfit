# SYNFIT AI — AI COACH UI/UX REDESIGN REPORT
## Modern Athletic Experience · Electric Indigo + Midnight + Volt Lime

### 1. Ringkasan Eksekutif

Halaman dan komponen AI Form Coach pada aplikasi member SynFit telah di-redesign sepenuhnya dari panel monitoring teknis yang kaku dan monoton menjadi pengalaman latihan premium yang modern, sporty, human-centered, dan dinamis. Seluruh fungsionalitas inti (MediaPipe pose detection, BLE smartwatch Aolon GT Curve, real-time rep counter, biomechanical feedback, sound/TTS, dan persistensi sesi Firestore) tetap dipertahankan 100% tanpa regresi.

---

### 2. Komponen dan File yang Diubah

| File | Status | Peran & Modifikasi Utama |
|---|---|---|
| `src/components/SmartwatchHeartRate.tsx` | Modified | Redesign kartu menjadi "Heart Rate Monitor" yang ringkas dengan hierarki visual terarah, mini heart rate sparkline, indikator status live/stale, serta disclosure panel expandable ("Lihat Detail →") yang tidak memadati viewport utama. |
| `src/components/AIFormCoach.tsx` | Modified | Redesign hero section atletik, 2-column responsive layout di desktop, kartu "Choose Your Workout" yang visual dan berorientasi fitness, perbaikan floating HUD kamera saat latihan, serta kartu ringkasan hasil latihan yang bersih dan sporty. |
| `docs/ui/ai-coach-redesign.md` | Created | Dokumentasi arsitektur, perubahan desain, pengujian, dan catatan perangkat fisik. |

---

### 3. Implementasi Design System SynFit

Penerapan design tokens yang konsisten pada mode terang (*Light Mode*) dan mode gelap (*Dark Mode*):

```css
/* Design Tokens SynFit AI */
Primary Indigo:   #6C63FF  /* Tombol utama, elemen interaktif, active chips, sparklines */
Volt Lime:        #D7FF38  /* CTA terpenting ("Mulai Latihan"), progress bar, target highlight */
Flame Orange:     #FF6B00  /* Aksen energi atletik: ikon api, repetisi aktif, peak BPM, rest timer */
Dark Background:  #101322  /* Latar belakang halaman dark mode */
Dark Surface:     #1C2034  /* Kartu & panel utama dark mode */
Light Background: #F7F8FC  /* Latar belakang halaman light mode */
Light Surface:    #FFFFFF  /* Kartu & panel utama light mode */
Text Light Mode:  #161A35 (Primary) · #62677A (Secondary)
Text Dark Mode:   #F4F5FC (Primary) · #B5B9CC (Secondary)
Semantic Alerts:  Emerald (#10B981) · Amber (#F59E0B) · Rose/Red (#EF4444)
```

- Menambahkan aksen **Flame Orange (`#FF6B00` / `#FF8533`)** sebagai aksen energi atletik yang terukur (tidak dominan, melainkan pelengkap hangat untuk Indigo dan Volt Lime).
- Kontras teks memenuhi standar aksesibilitas WCAG pada kedua mode tema.

---

### 4. Detail Perubahan per Bagian

#### 4.1. Human-Centered Hero Section
- **Sebelumnya**: Judul teknis kaku *"COMPUTER VISION ENGINE - SynFit AI Form Coach"* dengan paragraf panjang.
- **Sesudah**: 
  - Sapaan hangat: `"Siap berlatih?" / "Ready to train?"`
  - Judul utama berorientasi fitness: `"Latihan lebih cerdas. Bergerak lebih baik."`
  - Deskripsi singkat 2 baris mengenai evaluasi postur dan hitungan repetisi.
  - Latar belakang foto atlet (`/hero_strength.jpg`) dengan overlay gradient gelap halus agar teks sangat terbaca dan kontras.
  - CTA Utama bergaya Volt Lime: `"Mulai Latihan"` yang otomatis menggulir halus ke pilihan gerakan.
  - Indikator data aktual sistem: jumlah latihan tersedia (`3 latihan tersedia`) dan sesi yang telah diselesaikan member (`X sesi selesai`).

#### 4.2. Smartwatch & Heart Rate Monitor
- **Struktur Kartu**:
  1. **Status Koneksi Perangkat**: Status terhubung (`Aolon GT Curve · Terhubung`) dengan dot hijau berkedip, status menghubungkan (`Menghubungkan...`), atau status terputus (`Belum terhubung`).
  2. **Nilai BPM Aktual**: Teks angka mono berukuran besar (`-- BPM` atau `72 BPM`) disertai ikon denyut jantung dan tag zona kardio (`Z1` - `Z5`).
  3. **Waktu Pembaruan Terakhir**: Waktu sampel relatif (`Baru saja`, `X dtk lalu`). Jika sampel tertunda/berhenti diterima, badge `Data tidak terbaru` ditampilkan tanpa menampilkan data live palsu.
  4. **Mini Heart Rate Sparkline**: Visual grafik tren area yang ringkas (tinggi ~64px) menggunakan warna Indigo `#6C63FF`.
  5. **Disclosure "Lihat Detail →"**: Tombol toggle yang membuka panel riwayat lengkap:
     - Grafik sesi interaktif dengan sumbu waktu dan nilai BPM.
     - Ringkasan statistik biometrik valid: BPM Minimum, Peak BPM, dan BPM Rata-rata.
     - Tombol Reset Sesi.
- **Handling Disconnected**: Tombol eksplisit `"Hubungkan Smartwatch"` dengan panduan singkat Web Bluetooth LE tanpa data simulasi dummy.

#### 4.3. Workout Selection ("Choose Your Workout")
- **Judul**: `"Pilih Latihan Anda"` / `"Choose Your Workout"` dengan subjudul `"Pilih latihan dan mulai tingkatkan progresmu."`
- **Filter Otot**: Chips horizontal modern (`Semua`, `Kaki & Glutes`, `Dada & Tricep`, `Lengan (Biceps)`).
- **Kartu Latihan**:
  - Foto aset lokal beresolusi tinggi (`/squat.jpg`, `/push_up.jpg`, `/bicep_curl.jpg`).
  - Target repetisi default (`8`, `10`, `12`, `15` repetisi).
  - Target kelompok otot utama (`Kaki & Glutes`, `Dada & Tricep`, `Lengan`).
  - Fokus deteksi AI dengan poin-poin biomekanik yang jelas.
  - Tombol aksi `"Mulai"` dengan micro-interaction hover.

#### 4.4. Mode Latihan Aktif (Live Camera HUD)
- **Viewport Kamera**: Prioritas utama dengan rasio responsif (vertikal di mobile, 16:9 di desktop) dan skeleton overlay MediaPipe.
- **Top Bar**: Tombol `"Kembali"`, indikator `"LIVE COACH SET X"`, target phase (`READY`, `ECCENTRIC`, `CONCENTRIC`), smartwatch compact HUD, dan tombol kontrol `Jeda`, `Akhiri`, `Ganti`.
- **Bottom HUD**:
  - Hitungan repetisi besar dan tegas: `05 / 12`.
  - Form Score dengan progress bar Indigo-to-Volt Lime dan badge status semantik (`Elite`, `Good`, `Needs Adjustment`).
  - Stream instruksi koreksi ringkas dari AI Form Coach (misalnya: *"Turunkan tubuh sedikit lagi"*, *"Pertahankan postur dada tegap"*, *"Gerakan bagus, lanjutkan"*).
  - Indikator detak jantung live jika smartwatch tersambung.

#### 4.5. Ringkasan Sesi & Evaluasi (Set Completed & Summary)
- Kartu statistik yang mudah dipindai: Durasi total, Total repetisi, Set terselesaikan, dan Rata-rata Form Score.
- Rekap Biometrik Kardio Sesi dari sampel BLE aktual (Rata-rata BPM, Puncak BPM, Terendah BPM).
- Evaluasi akhir AI Form Coach berbasis MediaPipe.
- Tombol simpan aman ke Firestore dan opsi kembali ke menu utama.

#### 4.6. Tata Letak Responsif (Mobile & Desktop)
- **Mobile (< 1024px)**: Tata letak vertikal terurut (Hero -> Workout Options / Smartwatch Card) dengan scrolling yang minimal dan nyaman.
- **Desktop (>= 1024px)**: Tata letak 2 kolom (`col-span-8` untuk Workout Selection, `col-span-4` untuk Smartwatch Monitor & Riwayat Sesi). Menghindari kekosongan ruang horizontal dan mengurangi scrolling berlebih.

---

### 5. Hasil Pengujian dan Verifikasi Kode

- **TypeScript Compilation**: Menjalankan `npx tsc --noEmit` menghasilkan `exit code 0` tanpa error tipe data baru.
- **Asset Integrity**: Seluruh gambar menggunakan aset lokal dalam direktori `public/` (`hero_strength.jpg`, `squat.jpg`, `push_up.jpg`, `bicep_curl.jpg`).
- **Data Integrity**: Tidak ada penambahan nilai BPM dummy atau simulasi data yang disamarkan sebagai data aktual.
- **Dev Server**: Server Next.js tetap aktif di port 3000 tanpa runtime crashes.

---

### 6. Catatan Pengujian Perangkat Fisik

Fitur-fitur berikut memanfaatkan Web API browser yang memerlukan pengujian pada perangkat fisik pengguna:
1. **Bluetooth LE Smartwatch (Aolon GT Curve)**:
   - Memerlukan browser yang mendukung Web Bluetooth API (Google Chrome pada Windows/Android/macOS).
   - Pengujian pairing dan penerimaan notifikasi GATT karakteristik `0x2A37`.
2. **Kamera & MediaPipe Vision**:
   - Memerlukan izin akses kamera (`navigator.mediaDevices.getUserMedia`).
   - Akselerasi hardware WebGL/GPU untuk inferensi `PoseLandmarker` 30 FPS.
