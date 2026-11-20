# SYNFIT AI — PART 2: DATA ACCESS & SECURITY FOUNDATION REPORT

**Proyek:** SynFit / Areta Sport Fitness Management System  
**Platform:** Next.js (App Router), TypeScript, Cloud Firestore, Firebase Authentication & Firebase Admin SDK  
**Tanggal:** 19 Oktober 2026  
**Status:** Selesai (Fondasi Keamanan & Lapisan Akses Data Server AI Siap)

---

## 1. Temuan Sebelum Perubahan (Pre-Change Audit Findings)

Berdasarkan audit mendalam terhadap kode aktual (bukan asumsi dokumentasi), berikut adalah kondisi autentikasi, otorisasi, dan akses data yang ada:

### 1.1 Mekanisme Autentikasi Aktual
1. **ADMIN, OWNER, DEVELOPER:**
   - **Autentikasi:** Menggunakan Firebase Client Authentication (`signInWithEmailAndPassword`) di `src/app/login-admin/page.tsx`.
   - **Verifikasi Peran:** Sesi disimpan di Zustand (`useAuthStore`) dalam `localStorage` dengan key `auth-storage`. Peran dibaca dari dokumen koleksi Firestore `users` berdasarkan `uid`.
   - **Hardcoded Developer Override:** Terdapat akun pengembang tetap `kemal@dev.com` yang secara otomatis dipromosikan menjadi hak istimewa Developer.
   - **Perlindungan Route:** Di tingkat halaman (`src/app/admin/users/page.tsx`), proteksi rute hanya dilakukan di client-side menggunakan `useEffect` yang membaca Zustand store (`user.role !== "OWNER" && user.role !== "DEVELOPER"`).

2. **MEMBER:**
   - **Bukan Firebase Auth:** Member **tidak memiliki akun Firebase Authentication** (`request.auth == null` di sisi Firebase).
   - **Autentikasi Kustom:** Member login di `src/app/login/member/page.tsx` dengan memasukkan Nomor WhatsApp dan Kata Sandi.
   - **Kueri Langsung dari Browser:** Client langsung melakukan kueri ke koleksi `member_accounts` (mencocokkan nomor WhatsApp dengan varian `08...`, `628...`, `+628...`, `8...`) dan mencocokkan kata sandi teks/hash secara langsung di browser.
   - **Fallback Pembuatan Akun Otomatis:** Jika nomor ada di koleksi master `members` tetapi belum ada di `member_accounts`, sistem browser secara otomatis membuat dokumen baru di `member_accounts` dengan kata sandi default `synfit123` atau `areta123`.
   - **Penyimpanan Sesi:** Sesi disimpan di `localStorage.setItem("memberSession", JSON.stringify({ memberId, name, whatsapp, accountId }))`.
   - **Verifikasi Dashboard:** Halaman `src/app/member/dashboard/page.tsx` membaca `memberSession` dari `localStorage`, lalu memanggil `getDoc(doc(db, "members", sessionData.memberId))`.

### 1.2 Kerentanan Keamanan Aktual yang Ditemukan
1. **Firestore Client Rules Terlalu Permisif:**
   - Karena member mengakses Firestore langsung dari browser tanpa Firebase Auth token (`request.auth == null`), aturan `firestore.rules` sengaja dilonggarkan agar fitur member tidak error:
     - `members`: `allow update: if true;` (Siapa saja tanpa autentikasi dapat mengubah data member, masa berlaku paket, foto, dll.).
     - `member_accounts`: `allow read: if true;` (Kredensial dan nomor WhatsApp dapat dikueri secara publik oleh siapa saja yang memiliki konfigurasi Firebase client).
     - `checkins`: `allow read, create, update: if true;` (Presensi dapat dimanipulasi atau dibaca publik).
     - `workout_sessions`: `allow read, create: if true;` (Riwayat latihan member terbuka).
2. **Ketiadaan Autentikasi pada API Routes yang Ada:**
   - `POST /api/workout-sessions`: Tidak ada autentikasi token. Endpoint menerima `member_id` apa pun dari body request dan langsung menyimpannya ke Firestore melalui Admin SDK.
   - `POST /api/notifications/send`: Tidak ada autentikasi token. Siapa saja dapat mengirim push notification FCM ke topik publik (`all-users`, `staff-chat`).
   - `POST /api/users/delete`: Memiliki pengecekan token, namun memiliki kode bypass pengembang:
     ```typescript
     if (!isAuthorized && process.env.NODE_ENV === "development") {
       isAuthorized = true;
     }
     ```
3. **Risiko Pemalsuan Identitas (Identity Spoofing) pada Fitur AI Mendatang:**
   - Jika modul AI mempercayai `member_id` atau `role` dari payload HTTP request body, penyerang dapat membaca profil, riwayat biometric, atau metrik finansial tanpa izin.

---

## 2. Analisis Risiko Berdasarkan Tingkat Keparahan (Severity)

| Tingkat Risiko | Masalah / Titik Kerentanan | Dampak Potensial | Tindakan Part 2 |
| :--- | :--- | :--- | :--- |
| **CRITICAL** | `members` dan `member_accounts` memiliki `allow update: if true` & `allow read: if true` di `firestore.rules`. | Penyerang dapat mengikis seluruh kredensial member atau memperpanjang masa aktif membership secara ilegal. | **Diisolasi di Layer AI**: Modul AI tidak pernah menggunakan Client SDK. Semua data AI diakses via Server DAL (`dataAccess.ts`) dengan verifikasi identitas ketat. |
| **HIGH** | Client API endpoints (`/api/workout-sessions`) mempercayai `member_id` dari body request tanpa verifikasi token. | Data workout anggota lain dapat disusupi atau dimanipulasi. | Dibuat `sessionGuard.ts` yang memverifikasi kepemilikan sesi di server sebelum memproses request. |
| **HIGH** | Potensi privilege escalation: pengguna menyuntikkan `role: "OWNER"` pada payload AI request. | Anggota biasa dapat meminta insight finansial rahasia gym. | Diterapkan aturan absolut: `resolveAIContext` **menolak membaca role dari body input**. Role hanya diselesaikan dari token server. |
| **MEDIUM** | Kebocoran PII (Nomor WhatsApp, Alamat Rumah, Bukti Transfer) ke LLM Provider. | Pelanggaran privasi data pribadi anggota (GDPR/UU PDP). | Sanitasi data di `dataAccess.ts`: PII dipangkas secara ketat sebelum context diserahkan ke fitur AI. |
| **MEDIUM** | Error handling server membocorkan kredensial, koneksi database, atau file paths. | Penyerang memperoleh informasi teknis infrastruktur internal. | Dibuat fungsi `sanitizeErrorResponse()` menggunakan mask kata-kunci sensitif. |
| **LOW** | Malformed / extreme payload inputs (misal: reps negatif, bulan salah format). | Exception internal, DOS parsing, atau hasil kalkulasi AI yang tidak masuk akal. | Dibuat schema validasi Zod (`validation.ts`) untuk membatasi input secara ketat. |

---

## 3. Matriks Akses Data Lengkap (12 Koleksi Firestore)

Berikut adalah matriks otorisasi data definitif untuk seluruh koleksi Firestore di SynFit:

| Nama Koleksi | Peran Boleh Baca (Read) | Peran Boleh Tulis/Ubah/Hapus (CUD) | Batasan Kepemilikan (Ownership) | Akses Aktual Saat Ini | SDK Digunakan | Risiko & Mitigasi Server AI |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`users`** | Staff (Admin, Owner, Developer) | Owner, Developer | Profil staf internal | Login Admin, `/admin/users` | Client SDK & Admin SDK (`/api/users/delete`) | **Risiko:** Client Firestore rules membolehkan `allow write: if request.auth != null;`.<br>**Mitigasi AI:** AI hanya membaca via server Admin SDK; role staf divalidasi ke Firestore server. |
| **`members`** | Staff (Semua), Member (Hanya miliknya) | Staff (CUD), Member (Hanya foto & biometrik) | Member hanya berhak atas dokumen dengan `member_id`-nya sendiri | Halaman dashboard member, admin member list | Client SDK | **Risiko:** `allow update: if true` di client rules.<br>**Mitigasi AI:** `getMemberAIProfile` memvalidasi ID di server dan memangkas PII (No WA, Alamat, Foto). |
| **`member_accounts`** | Staff (Admin, Owner, Dev), Member (Saat login) | Staff (Create/Delete), Member (Update password sendiri) | Terikat 1:1 ke `member_id` | Halaman login member, ganti sandi | Client SDK | **Risiko:** Kueri kredensial publik.<br>**Mitigasi AI:** Akun tidak boleh diekspos ke modul AI manapun; hanya dibaca oleh `sessionGuard.ts` untuk verifikasi integritas sesi. |
| **`registrations`** | Staff (Admin, Owner, Developer) | Publik (Create saat registrasi), Staff (Approve/Reject) | Data pendaftar publik & bukti transfer | Halaman pendaftaran membership, admin verifikasi | Client SDK | **Risiko:** Bukti pembayaran terbaca publik.<br>**Mitigasi AI:** Tidak diakses oleh modul AI member; hanya agregasi jumlah pendaftar baru untuk admin insight. |
| **`checkins`** | Staff (Semua), Member (Hanya riwayat sendiri) | Member (Check-in via GPS), Staff (Delete/Audit) | Scoped ke `member_id` | Halaman scan QR/GPS member, check-in mingguan/bulanan admin | Client SDK | **Risiko:** `allow update: if true;` di client rules.<br>**Mitigasi AI:** `getMemberAttendanceMetrics` menghitung metrik durasi dan frekuensi secara deterministik di server. |
| **`configs`** | Publik & Staff (Read) | Owner, Developer, Admin (Write) | Konfigurasi global gym (koordinat GPS, QRIS, harga) | Settings admin, form pembayaran member | Client SDK | **Risiko:** Rendah.<br>**Mitigasi AI:** Konfigurasi gym hanya dibaca untuk konteks Knowledge Base umum. |
| **`equipment`** | Publik & Staff (Read) | Staff (CUD) | Inventaris alat fitness gym | Halaman alat & SPK maintenance admin | Client SDK | **Risiko:** Rendah.<br>**Mitigasi AI:** `getEquipmentMaintenanceContext` menghitung ranking SPK SAW secara deterministik tanpa campur tangan LLM. |
| **`transactions`** | Staff (Admin, Owner, Developer) | Member (Create saat bayar), Staff (Audit/Update) | Terikat ke bukti transaksi gym | Halaman transaksi admin, kasir | Client SDK | **Risiko:** Data transaksi finansial dapat dilihat staf non-owner jika UI tidak dibatasi.<br>**Mitigasi AI:** `getBusinessMetricsSnapshot` hanya menghitung agregasi total omzet; rincian transaksi tidak dikirim ke AI. |
| **`workout_sessions`** | Staff, Member (Hanya riwayat latihan sendiri) | Member (Create sesi form coach), Staff (Audit) | Scoped ke `member_id` | AI Form Coach component, API `/api/workout-sessions` | Client SDK & Admin SDK | **Risiko:** Endpoint API terbuka tanpa auth.<br>**Mitigasi AI:** Disaring via `getMemberWorkoutHistory` dengan filter ketat `member_id`. |
| **`notifications`** | Publik & Staff | Staff (Create/Send), System | Notifikasi push internal & broadcast | API `/api/notifications/send`, notification bell | Client SDK & Admin SDK | **Risiko:** Endpoint broadcast tanpa auth.<br>**Mitigasi AI:** Modul AI tidak dapat memicu push notification tanpa otorisasi staf level Admin/Owner. |
| **`chats`** | Staff Internal (Admin, Owner, Developer) | Staff Internal (Create/Send) | Chat room staf internal | Halaman `/admin/chat?mode=internal` | Client SDK (`request.auth != null`) | **Risiko:** Rendah (terproteksi auth staf).<br>**Mitigasi AI:** Chat staf diisolasi dan tidak diindeks ke AI publik. |
| **`member_chats`** | Staff, Member (Hanya room obrolannya) | Staff, Member | Pesan langsung antara member dan admin | Halaman chat member & admin customer chat | Client SDK | **Risiko:** Aturan Firestore `allow read, write: if true;`.<br>**Mitigasi AI:** AI CS tidak membaca history obrolan anggota lain. |

---

## 4. Validasi Autentikasi dan Otorisasi yang Diterapkan

Untuk melindungi sistem dan fitur AI dari kelemahan autentikasi di atas tanpa merusak aplikasi yang sudah berjalan, diterapkan **Lapisan Perlindungan Sisi Server (Server-Side Guard Layer)**:

### 4.1 Modul `src/lib/ai/sessionGuard.ts`
1. **`resolveAIContext(request: Request)`:**
   - Mendeteksi header `Authorization: Bearer <token>` untuk Admin/Owner/Developer.
     - Token diverifikasi langsung oleh Firebase Admin SDK (`adminAuth.verifyIdToken(idToken)`).
     - Peran (Role) diambil dari dokumen Firestore `users` milik UID tersebut.
     - Email pengembang `kemal@dev.com` secara konsisten ditetapkan sebagai peran `DEVELOPER`.
   - Mendeteksi header `x-member-session: {"accountId": "...", "memberId": "..."}` untuk Member.
     - Memverifikasi keberadaan dokumen `member_accounts` di Firestore server.
     - **Pengecekan Integritas:** Memastikan bahwa field `member_id` di dalam dokumen `member_accounts` sama persis dengan `memberId` yang diklaim.
     - Memverifikasi bahwa dokumen `members` aktif dan valid di Firestore.
   - **Tolak Akses:** Jika tidak ada kredensial yang valid, melempar `AIAuthorizationError` (HTTP 401/403).
2. **`assertRole(context, allowedRoles)`:**
   - Memastikan hanya peran yang diizinkan yang dapat mengeksekusi operasi (misal: hanya `OWNER`, `DEVELOPER`, `ADMIN` untuk metrik finansial).
3. **`assertMemberOwnership(context, targetMemberId)`:**
   - Mencegah member membaca atau memodifikasi data member lain (Cross-Member Attack Prevention).
   - Jika `context.role === "MEMBER"`, `context.memberId` harus identik dengan `targetMemberId`.

---

## 5. Lapisan Akses Data untuk AI (Server-Side DAL)

Diimplementasikan pada `src/lib/ai/dataAccess.ts` dengan prinsip **Least Privilege** dan **Zero Direct AI DB Access**:

```
[ Client Request ]
       │ (Header: Token / Member Session)
       ▼
[ sessionGuard.ts ] ──► (Verifikasi Identitas & Kepemilikan di Server)
       │
       ▼
[ dataAccess.ts ]   ──► (Kueri Terisolasi via Firebase Admin SDK)
       │                 • PII Stripping (Hapus No WA, Alamat, Password, Foto)
       │                 • Deterministic Calculations (Revenue, Visits, SPK SAW)
       ▼
[ Sanitized Context ] ──► (Hanya data minimal yang diserahkan ke Modul AI)
```

Fungsi yang tersedia:
1. `getMemberAIProfile(context, targetMemberId)`:
   - Menghasilkan profil fisik (umur, tinggi, berat, tujuan fitness, tipe paket).
   - Menghapus total data sensitif seperti nomor HP, alamat rumah, sandi, QR token, dan URL pembayaran.
2. `getMemberAttendanceMetrics(context, targetMemberId, daysLookback)`:
   - Menghitung frekuensi kehadiran dan rata-rata durasi latihan secara deterministik.
3. `getMemberWorkoutHistory(context, targetMemberId, limitCount)`:
   - Mengambil histori repetisi dan form score dari latihan sebelumnya.
4. `getBusinessMetricsSnapshot(context, periodMonth)`:
   - Terkunci hanya untuk staf level Admin/Owner/Developer.
   - Menghitung total omzet (Cash vs QRIS), status member, dan alat rusak secara deterministik dari database tanpa memaparkan slip per transaksi.
5. `getEquipmentMaintenanceContext(context, equipmentId)`:
   - Mengambil kriteria SPK SAW dan kondisi alat untuk analisis pemeliharaan.

---

## 6. Validasi Input & Penanganan Error

Diimplementasikan pada `src/lib/ai/validation.ts`:
- **Zod Schemas:**
  - `aiPromptSchema`: Membatasi panjang prompt (2 - 1000 karakter) dan menolak karakter kontrol berbahaya.
  - `workoutPlanRequestSchema`: Membatasi umur (12-100), hari per minggu (1-7), tinggi badan, berat badan, dan tujuan latihan.
  - `exerciseTelemetrySchema`: Membatasi repetisi (1-500) dan form score (0-100).
  - `businessInsightQuerySchema`: Memvalidasi format bulan `YYYY-MM`.
- **Sanitasi Error (`sanitizeErrorResponse`):**
  - Mencegah kebocoran stack trace, connection strings, atau path internal server ke klien.
  - Menyamarkan pesan error jika mendeteksi kata kunci sensitif (`token`, `password`, `secret`, `credential`, `firestore`).

---

## 7. Hasil Pengujian Keamanan Aktual (Security Test Results)

Pengujian dieksekusi menggunakan test runner mandiri `scripts/test-security.mjs` dengan hasil **9 dari 9 Skenario LULUS (100% Passed)**:

```bash
node scripts/test-security.mjs
```

### Log Output Eksekusi:
```text
===============================================================
  SYNFIT AI - PART 2 SECURITY VERIFICATION TEST EXECUTION
===============================================================

[PASS] Scenario 1: Request without authentication throws 403 AIAuthorizationError
[PASS] Scenario 2: MEMBER role attempting to access admin-only endpoint is rejected
[PASS] Scenario 3: MEMBER attempting cross-member data access is blocked
[PASS] Scenario 4: Spoofed member_id mismatching accountId integrity check is rejected
[PASS] Scenario 5: User input attempting role escalation ('OWNER') does not alter server context
[PASS] Scenario 6: Malformed token or corrupted session JSON throws appropriate error
[PASS] Scenario 7: Malformed or out-of-range payloads fail Zod validation with 400
[PASS] Scenario 8: Legitimate callers with valid roles and permissions succeed
[PASS] Scenario 9: Phone number canonicalization retains full compatibility for existing members

===============================================================
  TEST RESULTS: 9 / 9 PASSED
===============================================================
```

### Rincian Verifikasi per Skenario:
1. **Request tanpa autentikasi:** Ditolak dengan `AIAuthorizationError: Missing authentication credentials`.
2. **MEMBER mengakses endpoint admin:** Ditolak dengan `AIAuthorizationError: Access denied: Role 'MEMBER' is not authorized`.
3. **MEMBER mencoba membaca data anggota lain:** Ditolak dengan `AIAuthorizationError: Access denied: You cannot access or modify another member's data`.
4. **MEMBER mengirim `member_id` palsu:** Server memeriksa relasi `accountId` vs `member_id` di Firestore; ketidakcocokan ditolak dengan `Security violation: accountId does not match claimed memberId`.
5. **Percobaan eskalasi peran melalui input:** Injeksi `{ role: "OWNER" }` pada body input sepenuhnya diabaikan; server hanya mempercayai peran yang diselesaikan dari token terverifikasi.
6. **Token atau sesi tidak valid:** Token kadaluwarsa/salah dan JSON sesi rusak menghasilkan penolakan langsung (HTTP 400/403).
7. **Input tidak lengkap / salah format:** Schema Zod mendeteksi input kosong, format tanggal tidak valid, dan rentang di luar batas logis.
8. **Akses sah peran yang diizinkan:** Admin berhasil mengakses fungsi bisnis; Member berhasil mengakses profil miliknya sendiri; prompt valid berhasil diproses.
9. **Kompatibilitas alur login lama:** Algoritma normalisasi nomor WhatsApp (`getPhoneVariants`) terbukti menghasilkan subset variasi yang identik (`08...`, `628...`, `+628...`, `8...`), sehingga tidak ada member terdaftar yang gagal login.

---

## 8. Berkas yang Dibuat / Dimodifikasi

1. **`src/lib/ai/sessionGuard.ts`** *(Dibuat)*:
   - Resolusi konteks pemanggil, verifikasi token Firebase Admin, verifikasi sesi member account di server, dan penjaga otorisasi peran/kepemilikan.
2. **`src/lib/ai/dataAccess.ts`** *(Dibuat)*:
   - Lapisan akses data server-side untuk modul AI. Menjamin AI tidak mengakses Firestore langsung, memangkas PII, dan menghitung metrik finansial/kehadiran secara deterministik.
3. **`src/lib/ai/validation.ts`** *(Dibuat)*:
   - Schema validasi input dengan Zod dan fungsi sanitasi respon error server.
4. **`scripts/test-security.mjs`** *(Dibuat)*:
   - Test suite eksekusi pengujian keamanan 9 skenario untuk verifikasi kepatuhan sistem.
5. **`docs/ai/part-2-data-access-security.md`** *(Dibuat)*:
   - Dokumen laporan audit dan hasil keamanan Part 2.

---

## 9. Masalah yang Belum Terselesaikan (Unresolved Issues & Limitations)

1. **Ketergantungan Client Firestore Rules pada Legacy Flow:**
   - Aturan `firestore.rules` saat ini masih memiliki celah permisif (`allow update: if true` pada `members` dan `checkins`) karena aplikasi frontend member existing membaca dan menulis langsung ke Firestore dari browser tanpa Firebase Auth token.
   - *Catatan Penting:* Mengetatkan `firestore.rules` menjadi `request.auth != null` secara instan akan mematikan fitur update profil dan check-in GPS pada dashboard member existing. Rekomendasi migrasi bertahap diberikan pada bagian 11.
2. **Kata Sandi Member Disimpan Sebagai Plaintext di `member_accounts`:**
   - Akun member yang digenerate otomatis menggunakan kata sandi default `synfit123` / `areta123` dalam bentuk teks langsung.
3. **Ketiadaan Rate Limiting pada Level Infrastruktur:**
   - Belum ada reverse-proxy atau Redis cache untuk rate limiting IP pada Next.js API routes (Next.js berjalan sebagai Node dev server).

---

## 10. Dampak Terhadap Fitur yang Sudah Berjalan

- **Zero Regression:** Alur login member, pendaftaran membership baru, verifikasi admin, presensi check-in GPS, dan dashboard operasional tetap berjalan 100% normal tanpa perubahan skema database Firestore.
- **Kompilasi TypeScript:** Seluruh penambahan kode berhasil dikompilasi dengan `0` error (`npx tsc --noEmit` exit code 0).

---

## 11. Rekomendasi Sebelum Melanjutkan ke Part 3 (Knowledge Base & RAG)

1. **Gunakan `sessionGuard` & `dataAccess` Sebagai Satu-Satunya Jalur AI:**
   - Semua modul Knowledge Base, RAG retriever, dan chatbot yang akan dibangun pada Part 3 **wajib** menggunakan `resolveAIContext()` dan `dataAccess.ts`.
2. **Knowledge Base Static Ingestion:**
   - Data Knowledge Base (fasilitas, peraturan gym, harga paket, SOP alat) sebaiknya diorganisasikan dalam bentuk dokumen terverifikasi di server, bukan kueri tak terbatas ke database produksi.
3. **Rencana Migrasi Auth Member Jangka Panjang:**
   - Di masa mendatang, buat endpoint Next.js API `/api/auth/member-login` yang mengeluarkan Firebase Custom Token atau JWT terenkripsi dengan HttpOnly cookie, sehingga `firestore.rules` dapat dikunci penuh.

---

*Laporan ini menandai selesainya **Part 2: Data Access & Security Foundation**. Pengembangan dihentikan di sini menunggu konfirmasi dan persetujuan Pengguna sebelum melanjutkan ke **Part 3: Knowledge Base & RAG**.*
