# SYNFIT AI — PERSONAL WORKOUT PROGRAM BUILDER
## Manual Planning + AI-Powered Personalization Documentation

---

### 1. Ringkasan Eksekutif

Fitur **Program** pada aplikasi SynFit telah ditingkatkan secara menyeluruh menjadi pusat pengelolaan dan penyusunan program latihan yang sepenuhnya personal bagi setiap member. Member memiliki dua jalur utama dengan fleksibilitas setara:
1. **Buat Program Manual**: Panduan wizard terstruktur 5 langkah (Tujuan, Profil Latihan, Fasilitas & Preferensi, Batasan & Keselamatan, Review).
2. **Buat Program dengan AI**: Input percakapan bahasa bebas dengan ekstraksi otomatis, pertanyaan klarifikasi adaptif terhadap parameter yang belum diketahui, dan kompilasi opsi rekomendasi program.

Kedua mode berbagi struktur data yang sama, katalog gerakan yang terverifikasi, serta engine validasi keselamatan dan keseimbangan volume yang ketat.

---

### 2. Komponen dan File yang Diubah / Dibuat

| Path File | Status | Peran & Tanggung Jawab Utama |
|---|---|---|
| `src/types/workoutProgram.ts` | **Baru** | Definisi TypeScript type & interface lengkap untuk `WorkoutProgram`, `ProgramSession`, `ProgramExercise`, `ProgramPreferences`, `ProgramRecommendationOption`, dan `ProgramValidationResult`. |
| `src/data/workoutExerciseCatalog.ts` | **Baru** | Katalog standar gerakan gym SynFit yang dipetakan langsung ke 30 ID alat di `src/data/equipmentTutorials.ts`, kelompok otot, pola gerak, tingkat kesulitan, kontraindikasi cedera, dan flag validitas AI Coach (`squat`, `push_up`, `bicep_curl`). |
| `src/lib/program/programValidator.ts` | **Baru** | Engine validasi programatik independen yang memeriksa ketersediaan jadwal, kelayakan durasi per sesi, ketersediaan alat, tingkat keahlian, volume dan pemulihan otot (recovery 48 jam), kepatuhan batasan fisik/cedera, dan keabsahan referensi gerakan. |
| `src/lib/program/programGenerator.ts` | **Baru** | Generator rekomendasi program yang menghasilkan 2–3 opsi program berbeda secara bermakna (misal: *Hypertrophy Foundation*, *Functional Strength*, *Lean Burn & Conditioning*) dengan set/reps/rest tervalidasi. |
| `src/lib/program/aiExtractor.ts` | **Baru** | Modul NLP cerdas ekstraksi intent dan entitas dari deskripsi teks bebas, identifikasi data yang belum lengkap, serta penghasil pertanyaan klarifikasi adaptif. |
| `src/components/program/PersonalWorkoutProgramHub.tsx` | **Baru** | Komponen UI komprehensif mengelola 6 sub-tampilan: `view_active` (progres aktual non-fiktif, sesi berikutnya, jadwal mingguan), `landing` (headline & 2 kartu pilihan), `manual_wizard` (5 langkah), `ai_wizard` (percakapan, prompt chips, klarifikasi), `recommendations` (2-3 opsi), dan `editor` (kustomisasi gerakan, set, repetisi, swap modal). |
| `src/app/api/member/programs/route.ts` | **Baru** | Endpoint server RESTful untuk mengambil dan menyimpan program latihan dengan pengamanan `resolveAIContext` dan fallback client batching. |
| `firestore.rules` | **Diperbarui** | Menambahkan izin akses koleksi `workout_programs` (`match /workout_programs/{programId} { allow read, write: if true; }`). |
| `src/app/member/dashboard/page.tsx` | **Diperbarui** | Menghubungkan tombol cepat *Program*, banner *Personalize Your Program*, tab baru `"program"` pada `Tab` dan `TAB_ORDER`, tombol *Program Latihan* pada Desktop Sidebar, serta perenderan `renderProgramTab`. |

---

### 3. Alur Pengguna (User Flow)

#### A. Alur Manual (Wizard 5 Langkah)
1. **Langkah 1 (Tujuan)**: Member memilih 1 tujuan utama (*Hipertrofi/Massa Otot*, *Kekuatan*, *Fat Loss*, *Stamina/Kebugaran*, *Kebiasaan Latihan*, atau *Tujuan Lainnya*).
2. **Langkah 2 (Profil Latihan)**: Menentukan tingkat pengalaman (*Pemula*, *Menengah*, *Lanjutan*), frekuensi (2–6 hari/minggu), dan durasi sesi (30, 45, 60, 90 menit).
3. **Langkah 3 (Fasilitas & Fokus)**: Memilih modalitas latihan (*Kombinasi*, *Hanya Mesin*, *Free Weights*, *Bodyweight*) dan 1–3 prioritas kelompok otot (*Dada*, *Bahu*, *Punggung*, *Kaki*, *Lengan*, *Core*).
4. **Langkah 4 (Batasan & Keselamatan)**: Mendata riwayat keluhan atau area yang dihindari (*Bahu*, *Lutut*, *Pinggang*, *Pergelangan*) disertai banner peringatan keselamatan gym.
5. **Langkah 5 (Review & Kompilasi)**: Menampilkan rangkuman seluruh pilihan sebelum diproses ke halaman rekomendasi.

#### B. Alur AI (Percakapan Deskripsi Bebas)
1. **Input Teks Bebas**: Member mengetikkan target dengan gaya bahasa alami (atau memilih contoh prompt yang tersedia).
2. **Ekstraksi Cerdas**: Sistem mengekstrak parameter (tujuan, frekuensi hari, durasi, modalitas, fokus otot, batasan).
3. **Klarifikasi Adaptif**: Jika ada parameter kritis yang belum disebutkan (misal: jumlah hari atau tingkat pengalaman), AI hanya menanyakan hal-hal yang belum diketahui tersebut tanpa membebani pengguna dengan pertanyaan berulang.
4. **Kompilasi Rekomendasi**: Menghasilkan 2–3 opsi program yang divalidasi ke katalog gerakan.

---

### 4. Struktur Data Program (`WorkoutProgram`)

```typescript
export interface WorkoutProgram {
  id: string;
  memberId: string;
  name: string;
  description: string;
  source: "manual" | "ai";
  status: "draft" | "active" | "completed" | "archived";
  preferences: ProgramPreferences;
  sessions: ProgramSession[];
  currentWeek: number;
  totalWeeks: number;
  completedSessionIds: string[]; // ID sesi riwayat aktual dari Tracker
  version: number;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  history?: Array<{
    timestamp: string;
    action: string;
    details?: string;
  }>;
}
```

---

### 5. Aturan Validasi Programatik (`programValidator.ts`)

Setiap program (baik dari generator AI maupun editan manual pengguna) harus melewati validasi:
1. **Kesesuaian Jadwal**: Jumlah sesi latihan dalam seminggu harus sama persis dengan `daysPerWeek` yang dialokasikan member.
2. **Kelayakan Durasi**: Total estimasi waktu per sesi dihitung dari `(targetSets * (1.2 menit durasi set + restSeconds / 60))`. Jika selisihnya melebihi toleransi wajar, diberikan peringatan.
3. **Integritas Katalog**: Setiap `exerciseId` wajib terdaftar di `WORKOUT_EXERCISE_CATALOG` dan setiap `equipmentId` wajib memiliki padanan di `EQUIPMENT_TUTORIALS`.
4. **Kesesuaian Pengalaman**: Pemula tidak diberikan gerakan teknis Lanjutan tanpa supervisi.
5. **Distribusi Pemulihan (Recovery)**: Kelompok otot yang sama tidak dilatih berturut-turut pada hari berurutan tanpa jeda istirahat 48 jam.
6. **Kepatuhan Batasan**: Gerakan yang membebani area kontraindikasi (misal: bahu akut, nyeri lutut, pinggang) disaring dan diberikan alternatif aman.

---

### 6. Integrasi dengan Ekosistem SynFit

1. **Katalog Tutorial Alat (`/tutorials`)**:
   - Setiap kartu gerakan pada program memiliki tautan langsung ke panduan tutorial alat terkait menggunakan ID resmi dari `synfit-gym-equipment-tutorials.md`.
2. **AI Form Coach (Pose Estimation)**:
   - Badge dan tombol *"Latih dengan AI Form Coach"* disediakan **hanya** untuk gerakan yang benar-benar didukung oleh computer vision engine SynFit (`squat`, `push_up`, `bicep_curl`). Gerakan lain tidak mengklaim dukungan pose tracking.
3. **Tracker Latihan**:
   - Penghitung sesi selesai pada dashboard program dihitung langsung dari data riwayat `workout_sessions` yang tersimpan di Firestore / cache offline member. Tidak ada angka progres fiktif.
4. **Smartwatch & Heart Rate**:
   - Jika member mengaktifkan smartwatch (Aolon GT Curve), sesi latihan terintegrasi dengan pencatatan denyut jantung tanpa menjadikan smartwatch sebagai syarat mutlak pembuatan program.
5. **AI Assistant Floating**:
   - Floating AI chat tetap hadir dan berfungsi 24/7 di seluruh layar untuk menjawab pertanyaan member seputar program mereka.

---

### 7. Hasil Pengujian Aktual

1. **Uji Typecheck TypeScript**:
   - `npx tsc --noEmit` dieksekusi untuk memvalidasi seluruh type-safety pada komponen dan rute baru.
2. **Uji Validasi Program**:
   - Generator manual dan AI diuji untuk input 2 hari, 3 hari, 4 hari, dan 5 hari per minggu. Seluruh opsi menghasilkan struktur sesi yang valid.
3. **Uji Tema (Light Mode & Dark Mode)**:
   - Seluruh wizard, kartu rekomendasi, modal swap latihan, dan dashboard program aktif tampil kontras dan bersih pada latar belakang putih (`#FFFFFF` / `#F3F4F6`) maupun gelap (`#090B10` / `#141822`).
4. **Uji Responsivitas**:
   - Mobile: Stepper ringkas satu tangan, kartu touch-friendly.
   - Desktop: Layout 3-kolom pada rekomendasi dan grid terstruktur pada editor gerakan.

---

### 8. Batasan dan Rencana Pengembangan Lanjutan

1. **Penyimpanan Multi-Lingkungan**:
   - Implementasi saat ini mendukung penyimpanan ganda: API server Node.js (`/api/member/programs`) saat dijalankan dengan backend runtime, dan Firestore Client SDK langsung (`setDoc` / `getDocs`) yang didukung cache offline `localStorage` ketika dijalankan pada static hosting Firebase Classic.
2. **Pengembangan Pose AI Tambahan**:
   - Saat ini AI Form Coach berbasis MediaPipe mendukung 3 gerakan utama. Gerakan tambahan seperti *Dumbbell Lateral Raise* atau *Lunge* dapat ditambahkan model penjejakannya pada rilis berikutnya.
