# SYNFIT AI — PART 3: KNOWLEDGE BASE & RAG FOUNDATION REPORT

**Proyek:** SynFit / Areta Sport Fitness Management System  
**Platform:** Next.js (App Router), TypeScript, Cloud Firestore, Firebase Authentication & Firebase Admin SDK  
**Tanggal:** 19 Oktober 2026  
**Status:** Fondasi Knowledge Base & RAG Selesai Terverifikasi

---

## 1. Ringkasan Eksekutif

Tahap **Part 3: Knowledge Base & RAG Foundation** telah selesai dibangun sesuai standar keselamatan sistem dan integritas sumber. SynFit kini memiliki fondasi Knowledge Base resmi yang terstruktur di direktori `docs/knowledge/`, mesin pencari leksikal dengan ekspansi sinonim bahasa Indonesia (`LocalKnowledgeRetriever`), sistem sintesis jawaban yang berakar kuat pada kutipan dokumen resmi (`ragService.ts`), serta proteksi terhadap halusinasi dan prompt injection.

AI hanya diperbolehkan menyampaikan informasi sebagai fakta jika didukung oleh potongan dokumen yang telah terverifikasi. Seluruh informasi yang belum diketahui atau belum terdata di kode aplikasi telah ditandai dengan label `[NEEDS_VERIFICATION]` dan tidak akan dikarang oleh sistem.

---

## 2. Struktur Knowledge Base Resmi (`docs/knowledge/`)

Tujuh dokumen resmi telah disusun dan diverifikasi berdasarkan data aplikasi nyata (bukan asumsi):

| ID Dokumen | Judul Dokumen | Kategori | Ringkasan Konten Terverifikasi | Status |
| :--- | :--- | :--- | :--- | :--- |
| **`KB-GEN-001`** | [01-general-info.md](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/docs/knowledge/01-general-info.md) | `general_info` | Profil gym sejak 2020, alamat lengkap (Perum Alamanda Regency Blok E8. 15, Jl. Edelweis No.15, Karangsatria, Tambun Utara, Bekasi 17568), Maps resmi, kontak WhatsApp (+62 895-2802-2044), radius GPS 30m. | `VERIFIED` |
| **`KB-PRI-002`** | [02-membership-pricing.md](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/docs/knowledge/02-membership-pricing.md) | `membership_pricing` | Paket 1 Bulan (Rp 160.000), Paket 3 Bulan (Rp 480.000), Tarif Visit Harian (Rp 15.000 / hari), metode pembayaran (Tunai & QRIS). Catatan `NEEDS_VERIFICATION` untuk tarif PT privat. | `VERIFIED` |
| **`KB-OPS-003`** | [03-operating-hours.md](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/docs/knowledge/03-operating-hours.md) | `operating_hours` | Jam operasional Senin - Minggu (08.00 - 21.00 WIB setiap hari), prosedur presensi mandiri GPS dan scanner QR kasir. | `VERIFIED` |
| **`KB-RUL-004`** | [04-gym-rules.md](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/docs/knowledge/04-gym-rules.md) | `gym_rules` | Tata tertib gym: wajib sepatu olahraga, pengembalian beban ke rak, etika bergantian alat, aturan loker gratis, larangan merokok/alkohol. | `VERIFIED` |
| **`KB-FAC-005`** | [05-facilities-equipment.md](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/docs/knowledge/05-facilities-equipment.md) | `facilities_equipment` | Fasilitas Area Strength (dumbbells, barbells, benches, power racks), Area Cardio (treadmill, static bikes), loker, kamar mandi/shower, Wi-Fi gratis, Digital Member Card, AI Form Coach. | `VERIFIED` |
| **`KB-FAQ-006`** | [06-member-faq.md](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/docs/knowledge/06-member-faq.md) | `member_faq` | Tanya jawab umum anggota: cara pendaftaran online vs offline, login pertama kali, perpanjangan masa aktif, cara menggunakan AI Form Coach, drop-in fee. | `VERIFIED` |
| **`KB-SAF-007`** | [07-safety-guidelines.md](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/docs/knowledge/07-safety-guidelines.md) | `safety_guidelines` | Prosedur keselamatan: pemanasan/pendinginan, pemakaian safety collar/clamp pada barbell, etika spotter pada bench press/squat, hidrasi, kotak P3K. | `VERIFIED` |

---

## 3. Sumber Informasi yang Digunakan

Informasi di atas diekstraksi dari kode produksi aktual:
1. `src/app/membership/page.tsx`: Tarif Paket 1 Bulan (Rp 160.000) dan Paket 3 Bulan (Rp 480.000).
2. `src/app/admin/scanner/page.tsx`: Tarif Visit Harian (Rp 15.000).
3. `src/app/page.tsx`: Alamat fisik gym di Perum Alamanda Regency Tambun Utara, jam operasional 08.00 - 21.00 WIB, nomor WhatsApp resmi (+62 895-2802-2044), daftar fasilitas, dan tautan Google Maps.
4. `src/app/admin/settings/page.tsx`: Konfigurasi koordinat gym dan radius GPS presensi (30 meter).
5. `src/components/AIFormCoach.tsx`: Spesifikasi teknis AI Form Coach (Squat, Push-up, Bicep Curl).

---

## 4. Cara Dokumen Diproses dan Dicari (Retrieval Engine)

Diimplementasikan pada [src/lib/ai/knowledgeBase.ts](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/src/lib/ai/knowledgeBase.ts):

### 4.1 Chunking Berorientasi Konteks (`parseMarkdownDocument`)
- Header metadata dokumen (baris sebelum `## `) dipisahkan dari korpus pencarian agar tidak mencemari relevansi teks isi.
- Dokumen dipecah menjadi potongan (chunks) berdasarkan hierarki heading Markdown (`## ` dan `### `).
- Setiap chunk mempertahankan metadata dokumen asal: `chunkId`, `docId`, `docTitle`, `category`, `heading`, `isVerified`, dan daftar kata kunci terindeks.

### 4.2 Mesin Pencari Leksikal & Ekspansi Sinonim
- **Tokenisasi Cerdas:** Menghilangkan stop words bahasa Indonesia dan kata-kata jangkar umum (`synfit`, `areta`, `fitness`, `gym`) yang tidak memiliki daya pembeda spesifik.
- **Ekspansi Sinonim Tematik:** Mendukung istilah sepadan (contoh: `biaya` / `tarif` / `harga`, `jadwal` / `jam buka` / `operasional`, `drop in` / `sehari` / `visit`).
- **Pembobotan Hierarkis:** Kecocokan pada judul heading (`### `) diberi bobot lebih tinggi daripada kecocokan pada teks isi.

### 4.3 Verifikasi Cakupan Entitas (Entity Coverage Ratio)
- Untuk mencegah masalah umum RAG di mana pertanyaan tentang entitas asing (misal: "kolam renang", "sauna", "lapangan futsal") salah mencocokkan dokumen umum hanya karena mengandung kata umum "fasilitas" atau "synfit":
  - Sistem menghitung rasio cakupan token kata benda unik kueri pengguna (`tokenCoverageRatio`).
  - Jika kurang dari 40% kata kunci spesifik pengguna ditemukan dalam chunk kandidat, sistem **menetapkan status `hasSufficientContext: false`**.

---

## 5. Cara Jawaban Dikaitkan dengan Sumber (Source Attribution)

Diimplementasikan pada [src/lib/ai/ragService.ts](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/src/lib/ai/ragService.ts):

1. **Format Respon Terstruktur:**
   Setiap jawaban menghasilkan objek `RAGAnswerResponse`:
   ```typescript
   {
     query: string;
     answer: string;
     confidence: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";
     sources: Array<{
       docId: string;
       docTitle: string;
       heading: string;
       isVerified: boolean;
       relevanceScore: number;
     }>;
     isGroundedInOfficialDocs: boolean;
     requiresStaffFollowup: boolean;
   }
   ```
2. **Penolakan Halusinasi (Anti-Hallucination):**
   - Jika `isGroundedInOfficialDocs === false`: AI tidak menebak jawaban, melainkan menjawab dengan sopan:
     > *"Mohon maaf, informasi mengenai hal tersebut belum tercantum dalam dokumen resmi SynFit atau memerlukan konfirmasi lebih lanjut. Untuk informasi resmi dan akurat, silakan langsung tanyakan ke staf resepsionis di gym atau hubungi WhatsApp resmi kami di +62 895-2802-2044."*
3. **Penyebutan ID Sumber Nyata:**
   - Jawaban resmi selalu menyertakan ID Dokumen asli (contoh: `[DOKUMEN KB-PRI-002: Harga dan Jenis Paket Membership SynFit]`).

---

## 6. Status Provider Model Bahasa

1. **Decoupled Architecture:**
   - Antarmuka RAG terpisah dari provider tertentu melalui `getAIServerConfig()`.
2. **Mode Offline / Deterministic Grounding (Aktif):**
   - Saat `provider === "none"` atau `GEMINI_API_KEY` belum disetel di lingkungan server, sistem **tidak crash** dan tidak merekayasa kunci palsu.
   - Sistem secara deterministik mengekstrak dan memformat bagian teks resmi yang relevan langsung dari Knowledge Base.
3. **Mode Generatif (Gemini API):**
   - Jika `GEMINI_API_KEY` diisi di `.env.local`, sistem mengirimkan prompt dengan instruksi ketat (temperature rendah 0.2, batas output 1024 token) dan batasan sistem agar model **hanya menjawab dari potongan dokumen yang disediakan**.
   - Jika panggilan LLM eksternal gagal karena kuota atau jaringan, sistem otomatis fallback ke sintesis deterministik lokal.

---

## 7. Batasan Keamanan & Pertahanan Prompt Injection

- **Perlakuan Teks Dokumen:** Teks dokumen diperlakukan murni sebagai DATA, bukan instruksi sistem yang dapat dieksekusi.
- **Pendeteksi Injeksi (`detectPromptInjection`):**
  - Pola perintah berbahaya seperti `ignore all previous instructions`, `abaikan instruksi sebelumnya`, `tampilkan password`, atau `tampilkan data pribadi seluruh member` dideteksi dan diblokir dengan `AIInjectionError`.
- **Nol PII:** Tidak ada satu pun nomor telepon anggota, foto, catatan medis pribadi, atau bukti pembayaran yang dimasukkan ke dalam Knowledge Base.

---

## 8. Hasil Pengujian Aktual (Part 3 Test Suite)

Pengujian dieksekusi menggunakan test runner:
```bash
node --experimental-strip-types scripts/test-part3-rag.mjs
```

### Log Eksekusi Terminal:
```text
========================================================================
   SYNFIT AI - PART 3 KNOWLEDGE BASE & RAG VERIFICATION SUITE
========================================================================

Loaded 31 verified knowledge chunks from docs/knowledge/

[PASS] [Test 1.1] Query for 1 Month Package price returns Rp 160.000 with KB-PRI-002 citation
[PASS] [Test 1.2] Query for gym operating hours returns 08.00 - 21.00 WIB with KB-OPS-003 citation
[PASS] [Test 1.3] Query for Daily Drop-in pass returns Rp 15.000
[PASS] [Test 2.1] Question about non-existent facility (sauna / kolam renang) politely declines without hallucinating
[PASS] [Test 2.2] Question about non-existent service (futsal) does not invent pricing
[PASS] [Test 3.1] Paraphrased query ('biaya drop in sehari berolahraga') correctly retrieves daily fee
[PASS] [Test 3.2] Paraphrased query ('lokasi peta alamat gym') correctly retrieves Alamanda Regency address
[PASS] [Test 4.1] parseMarkdownDocument handles empty or malformed markdown gracefully without crashing
[PASS] [Test 5.1] Query about Personal Trainer tarif identifies NEEDS_VERIFICATION and warns user
[PASS] [Test 6.1] Detects and blocks prompt injection attempting to override instructions
[PASS] [Test 6.2] Detects Indonesian prompt injection attempting to leak passwords
[PASS] [Test 7.1] Attempting to dump member personal records is blocked
[PASS] [Test 8.1] All returned citations map to valid verified knowledge document IDs

========================================================================
   TEST RESULTS: 13 / 13 PASSED (100%)
========================================================================
```

### Status Regresi & Kompilasi:
- **Kompilasi TypeScript (`npx tsc --noEmit`):** **0 Error (Exit Code: 0)**.
- **Uji Regresi Keamanan Part 2.1 (`scripts/test-part2-hardening.mjs`):** **14 / 14 LULUS (100%)**.

---

## 9. Berkas Baru yang Dibuat pada Part 3

1. **`docs/knowledge/`** *(7 Berkas Markdown Resmi)*:
   - `01-general-info.md`
   - `02-membership-pricing.md`
   - `03-operating-hours.md`
   - `04-gym-rules.md`
   - `05-facilities-equipment.md`
   - `06-member-faq.md`
   - `07-safety-guidelines.md`
2. **`src/lib/ai/knowledgeBase.ts`** *(Baru)*:
   - Parser markdown, chunker berorientasi heading, pengindeks kata kunci dengan sinonim, serta retriever leksikal dengan filter rasio cakupan entitas.
3. **`src/lib/ai/ragService.ts`** *(Baru)*:
   - Layanan sintesis jawaban RAG terakreditasi, pelacak kutipan dokumen, detektor prompt injection, dan fallback deterministik lokal.
4. **`src/app/api/ai/knowledge/route.ts`** *(Baru)*:
   - Endpoint API `POST /api/ai/knowledge` dengan validasi Zod dan integrasi opsional sesi pengguna.
5. **`scripts/test-part3-rag.mjs`** *(Baru)*:
   - Test suite eksekusi pengujian RAG 13 skenario.
6. **`docs/ai/part-3-knowledge-base-rag.md`** *(Baru)*:
   - Dokumen laporan arsitektur dan hasil pengujian Part 3.

---

## 10. Keterbatasan dan Risiko yang Tersisa

1. **Pencarian Leksikal vs Semantik Kompleks:**
   - Saat ini pencarian menggunakan algoritma leksikal yang diperkaya sinonim (BM25-style keyword matching). Untuk pertanyaan yang menggunakan metafora sangat abstrak tanpa kata kunci terkait, sistem akan mengarahkan anggota ke staf gym.
   - *Rencana Pengembangan:* Arsitektur `KnowledgeRetriever` telah dirancang agar modul vector embeddings dapat dihubungkan di masa depan tanpa merombak logika aplikasi.
2. **Topik Tertentu Masih `NEEDS_VERIFICATION`:**
   - Kebijakan pengembalian dana dan biaya pelatih privat belum tersedia secara resmi dan akan tetap diarahkan ke staf sampai manajemen gym menetapkan keputusan tertulis.

---

*Laporan ini menandai selesainya **Part 3: Knowledge Base & RAG Foundation**. Sesuai batasan operasional, proses dihentikan di sini. Kami menunggu konfirmasi dan persetujuan Pengguna sebelum melanjutkan ke **Part 4: AI Assistant & Specialized Modules**.*
