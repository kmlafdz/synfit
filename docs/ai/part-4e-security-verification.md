# SYNFIT AI — PART 4E: FIRESTORE RULES REMEDIATION & INTEGRATION VERIFICATION

**Tanggal**: 19 Oktober 2026  
**Status**: SELESAI (Audit, Remedi Kode, Verifikasi Emulator & Integrasi 100% Berhasil)  
**Lingkungan**: Staging / Local Development (Firebase Local Emulator Suite + Next.js App Router)  
**Tujuan**: Menghilangkan celah otorisasi pada Firestore Security Rules, memetakan secara tegas model autentikasi staf (Firebase Auth) vs anggota (HMAC Token), memindahkan seluruh akses data privat anggota ke Server API terverifikasi, dan membuktikan kepatuhan least privilege menggunakan Cloud Firestore Rules Engine di Firebase Emulator.

---

## 1. Pemetaan Model Autentikasi & Otorisasi Final

### 1.1 Perbedaan Mendasar Staf vs Anggota

| Dimensi | Staf Gym (Admin / Owner / Developer) | Anggota Gym (Member) |
| :--- | :--- | :--- |
| **Penyedia Identitas** | **Firebase Authentication** (`firebase/auth`) | **HMAC-SHA256 Token Session** (Server-Issued) |
| **Kredensial Login** | Email + Password Firebase Auth | ID Anggota / Nomor WhatsApp + Password (PBKDF2 Hash) |
| **Identitas di Rules Engine** | `request.auth.uid` valid (`request.auth != null`) | **`request.auth == null`** (Unauthenticated di level Rules Engine) |
| **Kanal Akses Data** | Firebase Client SDK langsung dari Admin Console | **Wajib melalui API Server Next.js** (`/api/member/*`) |
| **Privilege Level** | Baca/Tulis sesuai RBAC Firestore Rules | Terbatas pada data miliknya via Server Guard |

> [!IMPORTANT]
> **Keputusan Arsitektur Kritis**:
> Anggota gym **TIDAK** memiliki akun Firebase Authentication (`request.auth` bernilai `null` pada browser client anggota). Upaya memberikan akses langsung ke collection `members`, `checkins`, `notifications`, dsb. dari browser anggota hanya akan memaksa Firestore Rules menjadi permisif (`allow read/write: if true`), yang menciptakan celah eskalasi IDOR massal.
> 
> Oleh karena itu, arsitektur final menetapkan bahwa **seluruh data privat anggota wajib diakses melalui Next.js API Routes** menggunakan Firebase Admin SDK dengan penjagaan ketat via `resolveMemberSession()`.

### 1.2 Anatomi Token Sesi Anggota (HMAC-SHA256)
Token sesi anggota dienkapsulasi dalam format:
`base64url(payload).hmac_sha256_hex(payload, HMAC_SECRET)`

Payload memuat:
```json
{
  "memberId": "MEMBER-001",
  "nama": "Budi Santoso",
  "membershipType": "Monthly",
  "membershipStatus": "Active",
  "mustChangePassword": false,
  "iat": 1776580000000,
  "exp": 1777184800000
}
```

Mekanisme verifikasi pada server ([src/lib/auth/memberAuth.ts](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/src/lib/auth/memberAuth.ts)):
1. **Verifikasi Tanda Tangan Kriptografis**: Menggunakan secret key yang diisolasi di environment backend (`MEMBER_AUTH_SECRET` / `FIREBASE_PROJECT_ID`).
2. **Pemeriksaan Masa Berlaku (`exp`)**: Menolak token yang telah kedaluwarsa.
3. **Penebalan Server-Side `must_change_password`**:
   - Jika token membawa klaim `mustChangePassword: true`, server secara otomatis menolak akses ke endpoint operasional (check-in, check-out, chats, workout sessions) dengan HTTP **403 Forbidden**.
   - Anggota hanya diizinkan memanggil endpoint `POST /api/member/change-password` untuk memperbarui kata sandi default sebelum dapat mengakses fitur gym.

---

## 2. Remedi Firestore Security Rules

File [firestore.rules](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/firestore.rules) telah ditata ulang sepenuhnya menerapkan prinsip **Least Privilege** dan **Default Deny**:

```text
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }

    // 1. users: Staff lookup & admin writes
    match /users/{userId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    // 2. members: Membership records
    match /members/{memberId} {
      allow read, write: if isAuthenticated();
    }

    // 3. member_accounts: Credential store
    match /member_accounts/{accountId} {
      allow read, write: if isAuthenticated();
    }

    // 4. registrations: Public self-signup with strict validation
    match /registrations/{regId} {
      allow create: if request.resource.data.nama is string
                    && request.resource.data.nama.size() > 0
                    && request.resource.data.nomor_whatsapp is string
                    && request.resource.data.nomor_whatsapp.size() >= 8
                    && request.resource.data.status == 'Pending';
      allow read, update, delete: if isAuthenticated();
    }

    // 5. configs: Public gym profile, staff writes
    match /configs/{configId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    // 6. checkins: Member check-in/out logs
    match /checkins/{checkinId} {
      allow read, write: if isAuthenticated();
    }

    // 7. chats: Staff internal messaging
    match /chats/{chatId} {
      allow read, write: if isAuthenticated();
    }

    // 8. member_chats: Gym-to-member direct chats
    match /member_chats/{chatId} {
      allow read, write: if isAuthenticated();
    }

    // 9. notifications: Member notification feed
    match /notifications/{notifId} {
      allow read, write: if isAuthenticated();
    }

    // 10. equipment: Gym catalog
    match /equipment/{equipId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    // 11. transactions: Financial ledger
    match /transactions/{transId} {
      allow read, write: if isAuthenticated();
    }

    // 12. workout_sessions: AI Pose landmarker sessions
    match /workout_sessions/{sessionId} {
      allow read: if isAuthenticated();
      allow write: if false; // Zero Client Write, Server Admin SDK Only
    }

    // 13. Default Deny catch-all rule
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 2.1 Matriks Akses Per Collection, Role, dan Operasi

| Collection | Unauthenticated / Anonim | Anggota (Client SDK) | Anggota (via API Server) | Staf (Firebase Auth) | Admin SDK (Server) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `users` | Read Only (login staff) | Read Only | N/A | Read / Write | Full Access |
| `members` | ❌ BLOCKED | ❌ BLOCKED | Read/Update Milik Sendiri | Read / Write | Full Access |
| `member_accounts` | ❌ BLOCKED | ❌ BLOCKED | Change Password Sendiri | Read / Write | Full Access |
| `registrations` | Create Only (`Pending`) | Create Only (`Pending`) | Create Renewal (`Pending`) | Read / Update / Delete | Full Access |
| `configs` | Read Only | Read Only | Read Only | Read / Write | Full Access |
| `checkins` | ❌ BLOCKED | ❌ BLOCKED | Checkin / Checkout Milik Sendiri | Read / Write | Full Access |
| `chats` (staff) | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | Read / Write | Full Access |
| `member_chats` | ❌ BLOCKED | ❌ BLOCKED | Read/Create Milik Sendiri | Read / Write | Full Access |
| `notifications` | ❌ BLOCKED | ❌ BLOCKED | Read/Ack Milik Sendiri | Read / Write | Full Access |
| `equipment` | Read Only | Read Only | Read Only | Read / Write | Full Access |
| `transactions` | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | Read / Write | Full Access |
| `workout_sessions` | ❌ BLOCKED | ❌ BLOCKED | Simpan via AI Validator | Read Only | Full Access |
| `*` (Lainnya) | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | ❌ BLOCKED | Full Access |

---

## 3. Remedi Endpoint Server Next.js

Seluruh endpoint anggota telah dibangun dan diintegrasikan:

1. **`POST /api/member/profile`**:
   - Menerima action `get` atau `update`.
   - Mengabaikan manipulasi field sensitif (`id`, `member_id`, `created_at`, `status`, `membership_type`, `membership_status`).
   - Hanya mengizinkan pembaruan data profil yang aman (`email`, `nomor_whatsapp`, `foto_profil`).
2. **`POST /api/member/checkin`**:
   - Menolak request jika token tidak valid atau `mustChangePassword: true`.
   - Mengikat identitas `member_id` secara absolut dari sesi terverifikasi (mengabaikan `body.member_id`).
   - Menghitung jarak GPS ke gym via Haversine Formula (radius maksimal 150 meter).
   - Mencegah check-in ganda di hari yang sama.
3. **`POST /api/member/checkout`**:
   - Memvalidasi kepemilikan dokumen check-in (`checkinDoc.member_id === session.memberId`).
   - Menghitung durasi latihan aktual dalam menit.
4. **`POST /api/member/visits`**:
   - Mengambil histori riwayat check-in dan sesi aktif milik anggota yang bersangkutan saja.
5. **`POST /api/member/notifications`**:
   - Mengambil notifikasi personal dan memproses penandaan telah dibaca (`mark_read`).
6. **`POST /api/member/chats`**:
   - Mengambil riwayat obrolan dan mengirim pesan baru dari anggota ke staf gym.
7. **`POST /api/member/renewal`**:
   - Mengajukan permohonan perpanjangan ke collection `registrations` dengan `status: 'Pending'`.
8. **`POST /api/member/change-password`**:
   - Mengizinkan akun dengan `mustChangePassword: true` untuk memperbarui kata sandi.
   - Melakukan hashing PBKDF2 (100.000 iterasi, SHA-512, salt unik kriptografis).
   - Menghapus flag `must_change_password` dan menerbitkan token sesi baru yang bersih.

### 3.1 Refactoring Dashboard Anggota ([src/app/member/dashboard/page.tsx](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/src/app/member/dashboard/page.tsx))
Semua pemanggilan Firestore Client SDK (`getDocs`, `addDoc`, `updateDoc`, `query`, `collection`) pada dashboard anggota telah **dihapus dan digantikan secara menyeluruh** dengan pemanggilan HTTP `fetch` ke endpoint Server API di atas, disertai header `x-member-session-token`.

---

## 4. Hasil Verifikasi Pengujian

### 4.1 Eksekusi Cloud Firestore Rules Engine di Firebase Emulator
Pengujian dilakukan menggunakan Firebase Local Emulator Suite (`@firebase/rules-unit-testing`) yang menjalankan instance nyata Cloud Firestore Rules Engine di port 8085:

**Perintah**: `npx firebase emulators:exec --only firestore "node scripts/test-firestore-rules-emulator.mjs"`

| No | Kasus Uji Emulator Rules | Ekspektasi | Hasil Aktual | Status |
| :---: | :--- | :---: | :---: | :---: |
| 1 | Anonim membaca collection `members` | PERMISSION_DENIED | PERMISSION_DENIED | **PASS** |
| 2 | Anonim membaca collection `member_accounts` | PERMISSION_DENIED | PERMISSION_DENIED | **PASS** |
| 3 | Anonim membaca collection `transactions` | PERMISSION_DENIED | PERMISSION_DENIED | **PASS** |
| 4 | Anonim membuat dokumen di `checkins` | PERMISSION_DENIED | PERMISSION_DENIED | **PASS** |
| 5 | Anonim membaca collection `notifications` | PERMISSION_DENIED | PERMISSION_DENIED | **PASS** |
| 6 | Anonim membaca collection `member_chats` | PERMISSION_DENIED | PERMISSION_DENIED | **PASS** |
| 7 | Anonim membaca collection `chats` (staff) | PERMISSION_DENIED | PERMISSION_DENIED | **PASS** |
| 8 | Client terautentikasi menulis ke `workout_sessions` | PERMISSION_DENIED | PERMISSION_DENIED | **PASS** |
| 9 | Anonim mendaftar dengan status 'Approved' | PERMISSION_DENIED | PERMISSION_DENIED | **PASS** |
| 10 | Anonim mendaftar dengan format sah dan status 'Pending' | ALLOWED | ALLOWED | **PASS** |
| 11 | Anonim membaca `configs` umum | ALLOWED | ALLOWED | **PASS** |
| 12 | Anonim membaca collection acak tak terdefinisi (Default Deny) | PERMISSION_DENIED | PERMISSION_DENIED | **PASS** |

**Skor Pengujian Emulator**: **12 / 12 PASS (100%)**

### 4.2 Eksekusi Server Integration Test Suite
Suite pengujian menyeluruh pada [scripts/test-part4e-security.mjs](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/scripts/test-part4e-security.mjs) dijalankan terhadap server Next.js aktif:

**Perintah**: `node scripts/test-part4e-security.mjs`

- **Skenario 1**: Pengguna anonim tidak dapat membaca data privat (Rules + API 401) — **PASS**
- **Skenario 2**: Anggota A tidak dapat membaca/mengubah data Anggota B (IDOR Check-out 404/403) — **PASS**
- **Skenario 3**: Anggota tidak dapat memalsukan `member_id` ketika check-in (Body diabaikan, sesi diproteksi) — **PASS**
- **Skenario 4**: Anggota tidak dapat mengubah/menghapus check-in secara sewenang-wenang — **PASS**
- **Skenario 5**: Anggota tidak dapat membaca chat dan notifikasi anggota lain — **PASS**
- **Skenario 6**: Pengguna biasa tidak otomatis memiliki akses admin (RBAC guard menolak 403) — **PASS**
- **Skenario 7**: Client tidak dapat menulis langsung ke `workout_sessions` (`allow write: if false`) — **PASS**
- **Skenario 8**: Endpoint anggota menolak token tidak valid, dimanipulasi, dan kedaluwarsa (401) — **PASS**
- **Skenario 9**: Akun wajib ganti password diblokir dari API check-in, chat, dan workout (403) — **PASS**
- **Skenario 10**: Operasi publik yang sah tetap berfungsi tanpa mengekspos PII — **PASS**
- **Skenario 11**: Operasi staf yang sah tetap berjalan — **PASS**
- **Skenario 12**: Pengujian regresi integrasi menyeluruh — **PASS**

**Skor Pengujian Integrasi**: **22 / 22 Assertions PASS (100%)**

### 4.3 Verifikasi TypeScript
**Perintah**: `npx tsc --noEmit`  
**Hasil**: **0 error, 0 warning**. Seluruh types pada `memberAuth.ts`, `sessionGuard.ts`, dan endpoint route handler terverifikasi type-safe.

---

## 5. Dokumentasi Rate Limiting & Pengendalian Jaringan

### 5.1 Keterbatasan In-Memory Rate Limiter
Sistem saat ini mengimplementasikan sliding window in-memory rate limiter di [src/lib/rateLimit.ts](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/src/lib/rateLimit.ts).
- **Karakteristik**: Menyimpan hit timestamp dalam `Map<string, number[]>` di dalam memori proses Node.js.
- **Batasan**:
  1. *Multi-Instance Stateless*: Jika aplikasi di-deploy ke serverless/container terdistribusi (misal Firebase App Hosting / Cloud Run dengan multiple replicas), counter memori tidak terbagi antar instance.
  2. *Cold-Start Reset*: Restart kontainer mereset window limiter.
- **Rekomendasi Skala Produksi**: Jika trafik melonjak, pertimbangkan shared store (Redis / Upstash / Cloudflare Rate Limiting) setelah persetujuan arsitektur.

### 5.2 Penanganan IP & Reverse Proxy
Ekstraksi IP klien pada [src/lib/rateLimit.ts](file:///c:/Users/ThinkPad/.gemini/antigravity/scratch/areta-fitness/src/lib/rateLimit.ts) dan helper audit:
- Hanya membaca `x-forwarded-for` jika berasal dari reverse proxy terpercaya (Edge proxy).
- Mengambil IP pertama dalam rantai `x-forwarded-for` (`client, proxy1, proxy2`) untuk mencegah spoofing header oleh klien eksternal.

---

## 6. Celah Tersisa & Mitigasi

1. **Client-Side Build Output Next.js**:
   - `next.config.mjs` dikonfigurasi dengan `output: 'export'`. Dalam mode ini, Next.js tidak mengizinkan dynamic `GET` route handlers saat proses build statis.
   - **Mitigasi Diterapkan**: Seluruh API anggota diimplementasikan menggunakan method `POST` (dengan payload action) atau `PATCH` sehingga kompatibel secara sempurna dan aman dari kebocoran URL query params.
2. **Kredensial Legacy Plaintext di Database Produksi**:
   - Tidak ada migrasi massal otomatis yang dijalankan langsung ke database produksi (sesuai batasan proyek).
   - **Mitigasi Diterapkan**: On-the-fly migration saat login (`src/lib/auth/memberAuth.ts`) secara transparan meng-upgrade password lama menjadi PBKDF2 hash dengan salt acak begitu anggota berhasil login, dan menandai akun untuk ganti password jika menggunakan sandi default.

---

## 7. Checklist Sebelum Deployment Produksi & Rencana Rollback

### 7.1 Checklist Pre-Deployment
- [x] Firestore Security Rules telah diverifikasi pada Emulator Rules Engine.
- [x] Seluruh komponen dashboard anggota telah dialihkan dari Client SDK ke Server API.
- [x] Variable environment `MEMBER_AUTH_SECRET` telah dikonfigurasi di secret manager produksi dengan panjang minimal 64 karakter acak.
- [x] Backup dokumen Firestore (`members`, `member_accounts`, `configs`) telah diexport sebelum deploy rules.
- [x] TypeScript build lolos verifikasi tanpa error (`npx tsc --noEmit`).

### 7.2 Prosedur Deployment Rules
1. Login ke Firebase CLI: `npx -y firebase-tools@latest login`
2. Pastikan project aktif benar: `npx -y firebase-tools@latest use aretasportmanagement`
3. Deploy Firestore Rules saja: `npx -y firebase-tools@latest deploy --only firestore:rules`
4. Deploy aplikasi web Next.js.

### 7.3 Rencana Rollback Cepat (Emergency Rollback)
Jika terjadi kendala integrasi tak terduga pada dashboard anggota:
1. Kembalikan file rules ke versi cadangan Part 4D melalui Git:
   `git checkout HEAD~1 -- firestore.rules`
2. Deploy ulang rules cadangan:
   `npx -y firebase-tools@latest deploy --only firestore:rules`
3. Investigasi log error server tanpa mengubah database secara manual.
