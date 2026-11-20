# SYNFIT AI — PART 4F: FINAL SECURITY & DEPLOYMENT ARCHITECTURE AUDIT

**Tanggal**: 19 Oktober 2026  
**Status**: SELESAI (Audit Kode Aktual, Remediasi Rules, Pengujian Emulator 19 Skenario & Integrasi Server 100% Berhasil)  
**Lingkungan Audit**: Local Staging & Emulator Suite (Firebase Local Emulator 8085 + Next.js App Router Node Runtime)  
**Tujuan**: Menuntaskan audit keamanan menyeluruh terhadap Firestore Security Rules berbasis Role-Based Access Control (RBAC), membedakan staf Firebase Auth biasa dari pemegang role berwenang (Owner/Developer), menutup akses baca publik pada koleksi `users`, melakukan analisis kritis terhadap kompatibilitas deployment Next.js (`output: 'export'` vs Server Runtime), serta membuktikan integritas API dan penegakan kata sandi.

---

## 1. Prioritas 1 — Role-Based Firestore Security Rules

### 1.1 Temuan Kode Aktual & Risiko
Sebelum audit Part 4F, ditemukan beberapa celah otorisasi pada aturan rules:
1. **Koleksi `users` Terbuka untuk Pembacaan Publik (`allow read: if true;`)**:
   - *Penyebab*: Halaman login staf ([src/app/login-admin/page.tsx](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/src/app/login-admin/page.tsx)) sebelumnya menjalankan kueri Firestore Client SDK sebelum proses autentikasi untuk mencari email berdasarkan `username`.
   - *Risiko*: Siapa pun di internet tanpa login dapat membaca seluruh dokumen `users`, memanen email staf, nama lengkap, foto profil, peran internal (`role`), dan konfigurasi akun (reconnaissance attack).
2. **Ketiadaan Pembatasan Role pada Penulisan User via Client SDK (`allow write: if isAuthenticated();`)**:
   - *Risiko*: Setiap pengguna yang berhasil login via Firebase Auth (bahkan akun staf level bawah atau tamu jika auth terbuka) dapat mengirimkan `addDoc` atau `updateDoc` untuk mengubah atau mengangkat role dirinya menjadi `Owner` atau `Developer` (Privilege Escalation).
3. **Pendaftaran Publik (`registrations`) Tanpa Whitelist Kunci**:
   - *Risiko*: Penyerang dapat mengirimkan payload pendaftaran publik dengan field tak terduga (misalnya menyuntikkan field internal, status palsu, atau skrip XSS tersimpan).
4. **Ketergantungan Tunggal pada `request.auth != null`**:
   - *Penyebab*: Operasi sensitif hanya memeriksa apakah pengguna terautentikasi tanpa memvalidasi field yang berubah atau membatasi operasi destruktif ke backend.

### 1.2 Remediasi Kode Aktual

#### A. Penutupan Total Koleksi `users` dari Akses Publik
- Koleksi `users` di [firestore.rules](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/firestore.rules) kini **sepenuhnya mengunci izin baca** ke `allow read: if isAuthenticated();`.
- Dibuat endpoint backend terisolasi: **`POST /api/auth/staff-lookup/`** ([src/app/api/auth/staff-lookup/route.ts](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/src/app/api/auth/staff-lookup/route.ts)).
  - Menggunakan Firebase Admin SDK di server.
  - Dilengkapi rate limiting sliding window (15 request/menit per IP) untuk mencegah enumerasi username.
  - Hanya mengembalikan atribut `{ success: true, email: string }` yang diperlukan untuk `signInWithEmailAndPassword`.
  - **Sama sekali tidak mengekspos** `role`, `uid`, `photoUrl`, `settings`, atau data pribadi staf lainnya ke publik.
- Halaman [src/app/login-admin/page.tsx](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/src/app/login-admin/page.tsx) diperbarui untuk memanggil endpoint lookup ini jika input login berupa username, dan hanya mengakses koleksi `users` di Firestore setelah Firebase Auth sign-in berhasil.

#### B. Pencegahan Eskalasi Role & Pembatasan Field
- **Pembuatan User Baru**: Dibatasi ketat hanya untuk staf terautentikasi dan **hanya diizinkan membuat role 'Admin'** dengan field whitelisted:
  ```text
  allow create: if isAuthenticated()
                && request.resource.data.keys().hasOnly(['uid', 'name', 'username', 'email', 'role', 'status', 'created_at', 'photoUrl', 'settings'])
                && request.resource.data.role == 'Admin'
                && request.resource.data.name is string
                && request.resource.data.username is string
                && request.resource.data.email is string;
  ```
- **Pembaruan User**: Pengguna tidak dapat mengubah field `role` miliknya (`request.resource.data.role == resource.data.role`), dan field yang boleh diedit dibatasi hanya pada profil (`name`, `photoUrl`, `settings`, `status`).
- **Penghapusan User**: Diblokir total dari Client SDK (`allow delete: if false;`). Penghapusan user wajib melalui endpoint server `/api/users/delete` yang secara ketat memverifikasi bahwa caller memiliki role `OWNER` atau `DEVELOPER`.

#### C. Whitelisting Field Registrasi Publik
Koleksi `registrations` kini menegakkan daftar izin field (whitelist) menggunakan fungsi `hasOnly()`:
```text
allow create: if request.resource.data.keys().hasOnly([
                'nama', 'nomor_whatsapp', 'email', 'jenis_kelamin', 'alamat',
                'membership_type', 'durasi_bulan', 'metode_pembayaran',
                'status', 'created_at', 'source', 'notes'
              ])
              && request.resource.data.nama is string
              && request.resource.data.nama.size() > 0
              && request.resource.data.nomor_whatsapp is string
              && request.resource.data.nomor_whatsapp.size() >= 8
              && request.resource.data.status == 'Pending';
```

#### D. Matriks Akses Firestore Security Rules Final

| Collection | Unauthenticated / Anonim | Anggota (Client SDK) | Staf Biasa (Firebase Auth) | Admin / Owner / Developer | Server Admin SDK |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `users` | ❌ BLOCKED | ❌ BLOCKED | Read Profile Sendiri / Staf | Read / Create Admin / Update Non-Role | Full Access (Termasuk Delete) |
| `members` | ❌ BLOCKED | ❌ BLOCKED | Read / Create / Update / Delete | Read / Create / Update / Delete | Full Access |
| `member_accounts` | ❌ BLOCKED | ❌ BLOCKED | Read / Create / Update / Delete (Sync) | Read / Create / Update / Delete (Sync) | Full Access |
| `registrations` | Create Only (`Pending`, Whitelisted) | Create Only (`Pending`) | Read / Update / Delete (Approval) | Read / Update / Delete (Approval) | Full Access |
| `configs` | Read Only (Logo, Jam, Lokasi) | Read Only | Read / Update | Read / Update | Full Access |
| `checkins` | ❌ BLOCKED | ❌ BLOCKED | Read / Scan QR / Checkout | Read / Scan QR / Checkout | Full Access |
| `chats` (staff) | ❌ BLOCKED | ❌ BLOCKED | Read / Write | Read / Write | Full Access |
| `member_chats` | ❌ BLOCKED | ❌ BLOCKED | Read / Reply | Read / Reply | Full Access |
| `notifications` | ❌ BLOCKED | ❌ BLOCKED | Read / Create Pengumuman | Read / Create Pengumuman | Full Access |
| `equipment` | Read Only | Read Only | Read / Write Inventory | Read / Write Inventory | Full Access |
| `transactions` | ❌ BLOCKED | ❌ BLOCKED | Read / Create Kasir | Read / Create Kasir | Full Access |
| `workout_sessions` | ❌ BLOCKED | ❌ BLOCKED | Read Only | Read Only | Full Access (Write Server Validator Only) |
| `*` (Catch-All) | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | Full Access |

---

## 2. Prioritas 2 — Next.js Deployment Compatibility Audit

### 2.1 Analisis Kondisi Aktual Repositori
1. **`next.config.mjs`**:
   ```javascript
   const nextConfig = {
     output: 'export',
     trailingSlash: true,
     images: { unoptimized: true },
   };
   export default nextConfig;
   ```
2. **`firebase.json`**:
   ```json
   "hosting": {
     "public": "out",
     "cleanUrls": true
   }
   ```
3. **`package.json`**:
   Memuat dependensi `@capacitor/android`, `@capacitor/ios`, dan `firebase-admin` (`^13.9.0`).

### 2.2 Konflik Arsitektur Kritis: Static Export vs Server Runtime

> [!CAUTION]
> **TEMUAN KRITIS DEPLOYMENT**:
> Proyek saat ini dikonfigurasi dengan `output: 'export'` dan mengarahkan Firebase Hosting ke direktori statis `out/`.
> 
> **Fakta Teknis:**
> 1. Pada mode `output: 'export'`, perintah `next build` menghasilkan file HTML/CSS/JS statis murni ke dalam folder `out/`.
> 2. **Next.js API Route Handlers (`src/app/api/*`) TIDAK DIHASILKAN atau DI-DEPLOY** ke dalam folder `out/` statis.
> 3. Library `firebase-admin` membutuhkan Node.js runtime dan kredensial service account; library ini **mustahil berjalan di browser klien atau CDN statis**.
> 4. Mengubah method HTTP API menjadi `POST` sama sekali **TIDAK membuat route handler berjalan di Firebase Hosting Classic statis**. Pada hosting statis, panggilan `fetch('/api/member/checkin/')` di production akan langsung menghasilkan HTTP **404 Not Found**.
> 5. Mode `next dev` berjalan mulus di lokal HANYA karena Turbopack/Next.js menjalankan server Node.js lokal di port 3000. Namun, jika folder `out/` di-deploy ke Firebase Hosting Classic, seluruh Server API (`/api/member/*`, `/api/auth/*`, `/api/workout-sessions`, `/api/users/delete`) akan mati total.

### 2.3 Rekomendasi Arsitektur Deployment Produksi

Untuk memastikan fitur keamanan server, enkapsulasi HMAC, validasi radius Haversine, dan `firebase-admin` berfungsi di production tanpa merusak fungsionalitas aplikasi, berikut adalah rekomendasi arsitektur:

#### Pilihan Utama (Sangat Disarankan): Firebase App Hosting
- **Mekanisme**: Firebase App Hosting mengelola build Next.js App Router secara otomatis menggunakan Cloud Run di backend dan Cloud CDN di frontend.
- **Keunggulan**:
  - API Routes berjalan di container serverless Node.js otomatis.
  - Environment variables sensitif (`MEMBER_AUTH_SECRET`, `FIREBASE_PROJECT_ID`, service account credentials) diisolasi dengan aman di Google Cloud Secret Manager.
  - Kompatibel penuh dengan Server Actions dan SSR.
- **Konfigurasi yang Diperlukan Sebelum Deploy**:
  - Hapus atau nonaktifkan `output: 'export'` pada `next.config.mjs` untuk target web.
  - Hubungkan repositori GitHub ke Firebase App Hosting via Firebase Console.

#### Pilihan Alternatif A: Cloud Run + Firebase Hosting Rewrites
- Ubah konfigurasi Next.js menjadi `output: 'standalone'`.
- Deploy kontainer Docker Next.js ke Cloud Run (region `asia-southeast2` Jakarta).
- Konfigurasikan `firebase.json` rewrites:
  ```json
  "hosting": {
    "rewrites": [
      {
        "source": "/api/**",
        "run": {
          "serviceId": "synfit-api",
          "region": "asia-southeast2"
        }
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
  ```

#### Pilihan Alternatif B: Target Khusus Mobile Capacitor
- Jika aplikasi ditujukan untuk build Android/iOS via Capacitor:
  - Aplikasi mobile APK/IPA tetap menggunakan bundle web statis.
  - Namun pemanggilan `fetch` pada aplikasi mobile diarahkan ke domain API server produksi yang aktif (misal: `https://api.synfit.id/api/...` atau `https://synfit-app-hosting.web.app/api/...`), bukan relative path lokal.

---

## 3. Prioritas 3 — Pengujian Emulator Komprehensif

Pengujian dieksekusi secara nyata terhadap Cloud Firestore Emulator Rules Engine (port 8085) menggunakan payload simulated authentication tokens:

**Perintah**: `npx firebase emulators:exec --only firestore "node scripts/test-firestore-rules-emulator.mjs"`

### 3.1 Hasil Uji Cloud Firestore Rules Engine (19 Kasus Uji)

| No | Skenario Rules Engine | Identitas Caller | Ekspektasi | Hasil Aktual | Status |
| :---: | :--- | :--- | :---: | :---: | :---: |
| 1 | Membaca dokumen `/users/staff1` | Anonim (Unauthenticated) | 403 Forbidden | Status 403 | **PASS** |
| 2 | Membaca dokumen `/users/staff1` | Staf Terautentikasi (Admin) | 200 / 404 | Status 404 | **PASS** |
| 3 | Membuat akun user dengan `role='Owner'` | Staf via Client SDK | 403 Forbidden | Status 403 | **PASS** |
| 4 | Membuat akun user dengan `role='Admin'` & field sah | Staf via Client SDK | 200 OK | Status 200 | **PASS** |
| 5 | Menghapus dokumen user langsung via Client SDK | Staf Terautentikasi | 403 Forbidden | Status 403 | **PASS** |
| 6 | Membaca data `/members/M001` | Anonim | 403 Forbidden | Status 403 | **PASS** |
| 7 | Membaca data `/members/M001` | Staf Terautentikasi | 200 / 404 | Status 404 | **PASS** |
| 8 | Membaca akun kredensial `/member_accounts` | Anonim | 403 Forbidden | Status 403 | **PASS** |
| 9 | Membaca riwayat `/checkins` | Anonim | 403 Forbidden | Status 403 | **PASS** |
| 10 | Membaca obrolan anggota `/member_chats` | Anonim | 403 Forbidden | Status 403 | **PASS** |
| 11 | Membaca notifikasi `/notifications` | Anonim | 403 Forbidden | Status 403 | **PASS** |
| 12 | Menulis transaksi `/transactions` | Anonim | 403 Forbidden | Status 403 | **PASS** |
| 13 | Menulis sesi latihan `/workout_sessions` | Staf / Client SDK (`allow write: if false`) | 403 Forbidden | Status 403 | **PASS** |
| 14 | Membaca konfigurasi publik `/configs/gym` | Anonim (`allow read: if true`) | 200 / 404 | Status 404 | **PASS** |
| 15 | Membaca katalog alat `/equipment/eq1` | Anonim (`allow read: if true`) | 200 / 404 | Status 404 | **PASS** |
| 16 | Pendaftaran publik baru status 'Pending' | Publik (Anonim) | 200 OK | Status 200 | **PASS** |
| 17 | Pendaftaran publik menyuntikkan field ekstra (`role`) | Publik (Injeksi Field) | 403 Forbidden | Status 403 | **PASS** |
| 18 | Pendaftaran publik memalsukan status 'Approved' | Publik (Status Tampering) | 403 Forbidden | Status 403 | **PASS** |
| 19 | Akses ke koleksi rahasia tak terdaftar `/secret_data` | Anonim (Default Deny) | 403 Forbidden | Status 403 | **PASS** |

**Skor Pengujian Rules Engine**: **19 / 19 PASS (100%)**

---

## 4. Prioritas 4 — Integritas API dan Penegakan Password

Suite pengujian integrasi server [scripts/test-part4f-security.mjs](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/scripts/test-part4f-security.mjs) dijalankan terhadap server lokal yang aktif:

**Perintah**: `node scripts/test-part4f-security.mjs`

### 4.1 Hasil Pengujian Integrasi Server (20 Asersi)
- **Skenario 1: Audit Koleksi users (Anti Reconnaissance & Anti Eskalasi)**:
  - Izin baca dikunci ke `isAuthenticated()` — **PASS**
  - Pembuatan akun membatasi role ke 'Admin' — **PASS**
  - Penghapusan via Client SDK diblokir total — **PASS**
- **Skenario 2: Whitelisting Field Registrasi & Default Deny**:
  - Validasi ketat `hasOnly()` aktif — **PASS**
  - Pemaksaan status `Pending` terbukti — **PASS**
  - Default Deny catch-all root terverifikasi — **PASS**
- **Skenario 3: Audit Koleksi Sensitif Lainnya**:
  - `workout_sessions` Zero Client Write — **PASS**
  - `transactions` dikunci untuk staf — **PASS**
- **Skenario 4: Analisis Deployment Compatibility**:
  - Pendeteksian tepat atas konflik `output: 'export'` vs API route server — **PASS**
  - Identifikasi kebutuhan runtime server produksi — **PASS**
- **Skenario 5: Endpoint `/api/auth/staff-lookup/`**:
  - Mengembalikan 404 pada username tak dikenal — **PASS**
  - Menolak input username tidak valid (HTTP 400) — **PASS**
- **Skenario 6: RBAC Server `/api/users/delete/`**:
  - Panggilan penghapusan user oleh non-Owner/non-Developer ditolak (HTTP 403) — **PASS**
- **Skenario 7: Penebalan Server `must_change_password`**:
  - Check-in diblokir (HTTP 403) pada token `mustChangePassword: true` — **PASS**
  - Chat diblokir (HTTP 403) pada token `mustChangePassword: true` — **PASS**
  - Menolak penggunaan ulang kata sandi default pada `change-password` — **PASS**
- **Skenario 8: Integritas Password PBKDF2 & Anti-Logging**:
  - Hashing PBKDF2 salt 32-karakter acak dan SHA-512 terverifikasi — **PASS**
  - Verifikasi password benar tanpa kebocoran log — **PASS**
  - Penolakan tegas password salah — **PASS**

**Skor Pengujian Integrasi**: **20 / 20 PASS (100%)**

---

## 5. Ringkasan Regresi Keseluruhan

| File Pengujian | Cakupan | Hasil |
| :--- | :--- | :---: |
| `scripts/test-firestore-rules-emulator.mjs` | Rules Engine Emulator (19 Skenario RBAC & Whitelist) | **19 / 19 PASS** |
| `scripts/test-part4f-security.mjs` | Final Security & Deployment Compatibility Suite | **20 / 20 PASS** |
| `scripts/test-part4e-security.mjs` | HMAC Member Session & API Integration Suite | **22 / 22 PASS** |
| `scripts/test-part4d-security.mjs` | Isolation & Anti-Tamper Verification Suite | **10 / 10 PASS** |
| `scripts/test-part4c-security.mjs` | PBKDF2 Password Migration & Security Suite | **10 / 10 PASS** |
| `scripts/test-part4b-coach.mjs` | MediaPipe AI Form Coach Hardening Suite | **10 / 10 PASS** |
| `scripts/test-part4a-assistant.mjs` | Member RAG AI Assistant 14-Scenario Suite | **14 / 14 PASS** |
| `npx tsc --noEmit` | Static Type Integrity Check | **0 Error, 0 Warning** |

---

## 6. Masalah Terbuka (Open Items) & Rekomendasi Sebelum Part 5

1. **Pemilihan Runtime Hosting Produksi**:
   - Sebelum deployment production, pemilik proyek harus menyetujui target hosting (Rekomendasi: **Firebase App Hosting**).
   - Menghapus konfigurasi `output: 'export'` pada `next.config.mjs` agar Next.js App Router dapat melayani server-side API routes di container Cloud Run.
2. **Kredensial Produksi**:
   - Menyiapkan environment variable `MEMBER_AUTH_SECRET` dengan string acak berkekuatan tinggi (minimal 64 karakter) di Google Cloud Secret Manager / platform hosting.
   - Mengonfigurasi `DEVELOPER_EMAILS` di environment produksi untuk whitelist peran Developer.

---

## 7. Batasan Kepatuhan (Absolute Constraints Compliance)

- **TIDAK ADA** deployment rules ke Firebase Console produksi.
- **TIDAK ADA** perubahan kredensial produksi atau migrasi data massal pada database live.
- **TIDAK ADA** penambahan fitur AI baru di luar perbaikan keamanan dan kompatibilitas arsitektur.
- **TIDAK** melanjutkan ke Part 5 secara sepihak. Proses dihentikan di sini menunggu konfirmasi pengguna.
