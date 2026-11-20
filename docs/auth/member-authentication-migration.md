# SynFit AI — Member Authentication Rework & Migration Guide
**Dokumentasi Resmi Integrasi: Firebase Authentication + Google OAuth + Resend Email**

---

## 1. Ringkasan Eksekutif & Arsitektur Baru

Sistem autentikasi member pada SynFit AI telah diperbarui secara menyeluruh dari autentikasi kredensial lokal ke **Firebase Authentication** sebagai penyedia identitas utama. 

### Pilar Arsitektur:
1. **Primary Identity Provider (Firebase Authentication)**:
   - Mendukung **Google OAuth** (`GoogleAuthProvider` via `signInWithPopup`) untuk login instan 1-klik dengan email Google yang terverifikasi otomatis.
   - Mendukung **Email & Password** dengan validasi keamanan, alur registrasi, dan verifikasi email wajib (`sendEmailVerification`).
   - Mendukung **Reset Kata Sandi** mandiri melalui email resmi Firebase (`sendPasswordResetEmail`).
   - Menyediakan kompatibilitas mundur (backward-compatibility) dengan nomor WhatsApp untuk memudahkan transisi member lama.
2. **Pemisahan Akun Autentikasi vs Status Membership Gym**:
   - Memiliki akun login Firebase (baik Google maupun Email) **tidak serta-merta** menjadikan pengguna sebagai member gym aktif berbayar.
   - Status keanggotaan gym (`Active`, `Pending`, `Expired`) dikelola dalam dokumen Firestore `members` dan diverifikasi di backend melalui Firebase Admin SDK.
   - Jika pengguna berhasil login Firebase namun belum memiliki profil keanggotaan di `members`, sistem otomatis mengarahkan pengguna ke formulir registrasi (`/membership?tab=register`) dengan data email & nama yang terisi otomatis (prefilled).
3. **Backend ID Token Verification**:
   - Setiap permintaan sesi atau API sensitif memvalidasi Firebase ID Token secara kriptografis menggunakan `adminAuth.verifyIdToken(idToken)`.
   - Endpoint: `/api/auth/member-firebase`.
   - Data role, UID, dan status verifikasi email diekstrak langsung dari payload token yang telah terverifikasi, bukan dari input form frontend biasa.
4. **Resend Transactional Email Engine**:
   - Terintegrasi menggunakan SDK resmi `resend` di server-side (`src/lib/email/resend.ts`).
   - Menyediakan template email responsif bergaya gelap atletik khas SynFit:
     - **Welcome Email**: dikirim setelah member disetujui / aktif.
     - **Membership Expiry Reminder**: pengingat masa aktif (H-3/H-7) dengan tombol perpanjangan langsung ke dasbor.
     - **Workout Summary**: ringkasan repetisi dan skor postur AI Form Coach.
   - Dilengkapi proteksi **Idempotency** (in-memory deduplication window) untuk mencegah pengiriman email berulang.

---

## 2. Alur Pengguna (User Journeys)

### A. Login Google OAuth (Member Terdaftar)
```mermaid
sequenceDiagram
    autonumber
    actor Member as Pengguna
    participant UI as Member Login (/login/member)
    participant Auth as Firebase Auth
    participant API as Backend (/api/auth/member-firebase)
    participant FS as Firestore (members)
    participant Dash as Member Dashboard

    Member->>UI: Klik "Lanjutkan dengan Google"
    UI->>Auth: signInWithPopup(auth, GoogleAuthProvider)
    Auth-->>UI: UserCredential (uid, email, emailVerified: true)
    UI->>Auth: user.getIdToken()
    Auth-->>UI: Firebase ID Token
    UI->>API: POST /api/auth/member-firebase (Bearer Token)
    API->>Auth: adminAuth.verifyIdToken(idToken)
    Auth-->>API: DecodedIdToken (uid, email)
    API->>FS: Query members where uid == uid (or email == email)
    FS-->>API: Member Document (status: Active)
    API-->>UI: { success: true, isMember: true, member }
    UI->>Dash: Simpan memberSession & router.replace("/member/dashboard")
```

### B. Login Google OAuth (Pengguna Baru / Belum Terdaftar)
```mermaid
sequenceDiagram
    autonumber
    actor User as Pengguna Baru
    participant UI as Member Login (/login/member)
    participant Auth as Firebase Auth
    participant API as Backend (/api/auth/member-firebase)
    participant FS as Firestore (members)
    participant Reg as Registrasi (/membership)

    User->>UI: Klik "Lanjutkan dengan Google"
    UI->>Auth: signInWithPopup(auth, GoogleAuthProvider)
    Auth-->>UI: UserCredential
    UI->>API: POST /api/auth/member-firebase (Bearer Token)
    API->>FS: Query members where uid == uid
    FS-->>API: Not Found (isMember: false)
    API-->>UI: { success: true, isMember: false, status: "None" }
    UI->>Reg: router.replace("/membership?tab=register&email=...&nama=...&uid=...")
    User->>Reg: Mengisi paket gym, alamat, nomor WhatsApp
    Reg->>FS: addDoc("registrations", { uid, email, nama, status: "Pending" })
```

### C. Alur Email & Password + Verifikasi
1. Pengguna memilih tab **Email** > **Registrasi Akun Baru**.
2. Mengisi Nama Lengkap, Email, Kata Sandi, dan Konfirmasi Kata Sandi.
3. Frontend mengeksekusi `createUserWithEmailAndPassword(auth, email, password)`.
4. Firebase Auth mengirim email verifikasi melalui `sendEmailVerification(user)`.
5. Banner status verifikasi muncul di layar login dengan instruksi dan tombol **Kirim Ulang Email** (dilengkapi pendingin rate-limit 60 detik).
6. Pengguna mengklik tautan di email mereka.
7. Di aplikasi, pengguna mengklik **Saya Sudah Verifikasi** (`auth.currentUser.reload()`), akun tervalidasi, dan diarahkan ke dasbor/registrasi.

---

## 3. Konfigurasi Firebase Console yang Wajib Diaktifkan

Buka [Firebase Console - SynFit Gym](https://console.firebase.google.com/project/synfitgym/authentication):

1. **Authentication > Sign-in method**:
   - **Google**: Aktifkan (Enabled). Masukkan nama proyek "SynFit Athletic Club" dan pilih email dukungan.
   - **Email/Password**: Aktifkan (Enabled). Pastikan opsi "Email link (passwordless sign-in)" dibiarkan nonaktif jika tidak diperlukan.
2. **Authorized Domains**:
   Pastikan domain-domain berikut terdaftar di **Authentication > Settings > Authorized domains**:
   - `localhost`
   - `synfitgym.firebaseapp.com`
   - `synfitgym.web.app`
   - Domain kustom produksi Anda (misal: `synfitgym.com`).
3. **Email Templates**:
   - Buka **Authentication > Templates**.
   - Sesuaikan nama pengirim: `SynFit Athletic Club`.
   - Email Verifikasi (`Email address verification`): sesuaikan pesan dan tautan tindakan.
   - Reset Kata Sandi (`Password reset`): sesuaikan subjek dan pesan.

> [!NOTE]
> **Status Custom Domain Email Firebase**:
> Pengaturan domain email kustom bawaan Firebase Authentication membutuhkan verifikasi record DNS (SPF, DKIM, DMARC) di domain registrar Anda. Email transaksional khusus (Welcome Email, Workout Summary, Membership Reminder) dialihkan sepenuhnya melalui **Resend** yang memiliki deliverability tinggi dan branding penuh.

---

## 4. Konfigurasi Environment Variables

Simpan variabel berikut di lingkungan server / hosting (.env.local untuk dev, Cloud Secrets untuk production):

```env
# ==========================================
# RESEND EMAIL SERVICE (Server-Only Secret)
# ==========================================
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL="SynFit Athletic Club <onboarding@resend.dev>"
APP_BASE_URL="https://synfitgym.web.app"

# ==========================================
# FIREBASE PUBLIC CLIENT CONFIG
# ==========================================
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCOSps-4CgXNalk_0E-aJPynj-O6MINDlI
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=synfitgym.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=synfitgym
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=synfitgym.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=305980548713
NEXT_PUBLIC_FIREBASE_APP_ID=1:305980548713:web:a5d75d921f7f24f1b364f8
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-5W8E1Z0SY5

# ==========================================
# FIREBASE ADMIN SDK (Server-Side Secrets)
# ==========================================
FIREBASE_PROJECT_ID=synfitgym
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@synfitgym.iam.gserviceaccount.com
# FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> [!CAUTION]
> **Larangan Keamanan**:
> Jangan pernah menggunakan `NEXT_PUBLIC_RESEND_API_KEY` atau menaruh Resend API Key di dalam kode frontend. Pengiriman email Resend dilakukan di server-side (`src/lib/email/resend.ts` atau Cloud Functions).

---

## 5. Ringkasan File yang Diubah & Dibuat

| File | Status | Deskripsi |
|---|---|---|
| `src/lib/email/resend.ts` | **Dibuat** | Modul layanan email terpusat resmi `resend` dengan template responsif, fallback mode pengujian lokal, dan proteksi idempotency. |
| `src/app/api/auth/member-firebase/route.ts` | **Dibuat** | Endpoint backend verifikasi Firebase ID Token via Admin SDK, resolusi profil member di Firestore, dan pemicu email sambutan. |
| `src/lib/ai/sessionGuard.ts` | **Diperbarui** | Menambahkan pengenalan role `MEMBER` untuk token Firebase Auth member pada AI Form Coach dan chat RAG. |
| `src/app/login/member/page.tsx` | **Dirombak** | UI login member baru dengan Google OAuth, Email/Password tab, modal verifikasi email, modal reset password, dan fallback WhatsApp. |
| `src/app/membership/page.tsx` | **Diperbarui** | Mengaitkan pengguna Firebase terautentikasi ke formulir registrasi, mengisi data otomatis, dan menyimpan `uid` serta `email` ke registrasi Firestore. |
| `src/app/member/dashboard/page.tsx` | **Diperbarui** | Mengintegrasikan `signOut(auth)` resmi Firebase pada proses logout dasbor member. |
| `scripts/test-auth-rework.mjs` | **Dibuat** | Skrip pengujian otomatis unit & integrasi untuk modul Resend, template rendering, idempotensi, dan isolasi keamanan. |
| `docs/auth/member-authentication-migration.md` | **Dibuat** | Dokumentasi lengkap arsitektur, alur kerja, pengujian, dan instruksi operasional. |

---

## 6. Hasil Pengujian Aktual

Suite pengujian otomatis dijalankan secara langsung via Node.js runtime (`scripts/test-auth-rework.mjs`) menggunakan API Key Resend aktual:

```
=================================================
SYNFIT AI — MEMBER AUTHENTICATION REWORK TEST SUITE
=================================================

--- PART 7: TEMPLATE EMAIL RENDERING ---
✅ [PASS] Welcome Email Template: Generates responsive branded HTML with SynFit logo & CTA
✅ [PASS] Membership Reminder Template: Generates warning card & days remaining
✅ [PASS] Workout Summary Template: Generates stats grid & AI accuracy breakdown

--- PART 6: RESEND EMAIL SERVICE & IDEMPOTENCY ---
[Resend] Welcome email sent successfully to synfit.assistant@syntriad.my.id (ID: 01a15c36-e434-7e1d-8e99-e04967bb5429)
✅ [PASS] Welcome Email: Handles execution and dispatches live
[Resend] Skipped duplicate welcome email to synfit.assistant@syntriad.my.id
✅ [PASS] Welcome Email Idempotency: Immediate duplicate email within 60s is caught
✅ [PASS] Membership Reminder Email: Dispatches gracefully
✅ [PASS] Workout Summary Email: Dispatches gracefully

--- PART 2 & 8: SECURITY, RBAC & SECRETS ISOLATION ---
✅ [PASS] Client Bundle Secret Leak Prevention: RESEND_API_KEY is not exposed with NEXT_PUBLIC_
✅ [PASS] Email Address Normalization: Sanitizes input before lookup
✅ [PASS] Phone Variant Generation: Standardizes Indonesian numbers

=================================================
TEST SUMMARY: 10 PASSED, 0 FAILED
=================================================
```

- **Live Email Delivery**: Email sambutan HTML responsif SynFit AI berhasil terkirim secara *live* ke alamat email terverifikasi pemilik akun Resend (`synfit.assistant@syntriad.my.id`) dengan ID Pesan: `01a15c36-e434-7e1d-8e99-e04967bb5429`.
- **Kompilasi TypeScript**: `npx tsc --noEmit` berhasil dieksekusi dengan kode keluar **0 (Zero Errors)**.
- **Production Bundle**: `npm run build` sukses mengompilasi seluruh 41 rute statis & dinamis.

---

## 7. Tindakan Manual Lanjutan (Admin Checklist)

1. **Aktifkan Provider Google & Email di Firebase Console**:
   - Buka Firebase Console > Authentication > Sign-in method > Aktifkan **Google** dan **Email/Password**.
2. **Dapatkan API Key Resend**:
   - Buat akun di [resend.com](https://resend.com).
   - Buat API Key baru dan masukkan nilai ke `RESEND_API_KEY` di server production.
   - Daftarkan domain pengirim (misal: `mail.synfitgym.com` atau gunakan domain terverifikasi Anda) di menu Domains Resend.
   - Perbarui `RESEND_FROM_EMAIL` dengan alamat domain terverifikasi tersebut.
3. **Pastikan Authorized Domains Terdaftar**:
   - Jika SynFit dideploy ke domain kustom, tambahkan domain tersebut ke tab **Authorized Domains** di Firebase Authentication.
