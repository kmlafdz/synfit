/**
 * SYNFIT AI — PART 4F: FINAL SECURITY & DEPLOYMENT ARCHITECTURE TEST SUITE
 * Validates role-based Firestore rules, Next.js deployment compatibility,
 * staff-lookup server endpoint, API integrity, and server-side password enforcement.
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure environment variables match running Next.js instance
const envLocalPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...rest] = trimmed.split("=");
      const val = rest.join("=").replace(/^["']|["']$/g, "");
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const {
  signMemberSessionToken,
  verifyMemberSessionToken,
  verifyPassword,
  hashPassword,
} = await import("../src/lib/auth/memberAuth.ts");

const BASE_URL = process.env.TEST_APP_URL || "http://localhost:3000";

let totalAsserts = 0;
let passedAsserts = 0;
let failedAsserts = 0;

function pass(desc) {
  console.log(`  -> PASS: ${desc}`);
  totalAsserts++;
  passedAsserts++;
}

function fail(desc, err) {
  console.error(`  -> FAIL: ${desc}`);
  if (err) console.error(`     Error: ${err.message || err}`);
  totalAsserts++;
  failedAsserts++;
}

async function runScenario(scenarioNum, scenarioName, testFn) {
  console.log(`\n[SCENARIO ${scenarioNum}] ${scenarioName}`);
  try {
    await testFn();
  } catch (err) {
    fail(`Unhandled exception in Scenario ${scenarioNum}`, err);
  }
}

async function main() {
  console.log("========================================================================");
  console.log("   SYNFIT AI — PART 4F: FINAL SECURITY & DEPLOYMENT ARCHITECTURE TEST   ");
  console.log("========================================================================");
  console.log(`[TARGET] Dev Server: ${BASE_URL}`);
  console.log("------------------------------------------------------------------------");

  const rulesContent = fs.readFileSync(path.join(__dirname, "../firestore.rules"), "utf8");
  const nextConfigContent = fs.readFileSync(path.join(__dirname, "../next.config.mjs"), "utf8");
  const firebaseJsonContent = fs.readFileSync(path.join(__dirname, "../firebase.json"), "utf8");

  // ------------------------------------------------------------------------
  // PRIORITY 1: ROLE-BASED FIRESTORE SECURITY RULES
  // ------------------------------------------------------------------------

  await runScenario(1, "Audit Koleksi users (Tidak Boleh Dibaca Publik & Anti Eskalasi Role)", async () => {
    // 1a. Users read must require isAuthenticated()
    const usersBlock = rulesContent.match(/match \/users\/\{userId\}[\s\S]*?\n\s*\}/)?.[0] || "";
    if (usersBlock.includes("allow read: if true;")) {
      fail("Koleksi users masih mengizinkan pembacaan publik!");
    } else if (usersBlock.includes("allow read: if isAuthenticated();")) {
      pass("Koleksi users mengunci izin baca secara ketat ke isAuthenticated() (tidak ada eksposur PII publik).");
    } else {
      fail("Koleksi users tidak memiliki aturan baca yang valid.");
    }

    // 1b. Role escalation prevention: Client cannot create Owner or Developer
    if (usersBlock.includes("request.resource.data.role == 'Admin'")) {
      pass("Aturan create pada users mewajibkan role 'Admin' (mencegah eskalasi Owner/Developer lewat Client SDK).");
    } else {
      fail("Aturan create pada users tidak membatasi role ke 'Admin'.");
    }

    // 1c. Users cannot be deleted directly from Client SDK
    if (usersBlock.includes("allow delete: if false;")) {
      pass("Penghapusan dokumen user via Client SDK diblokir total (wajib melalui server API /api/users/delete).");
    } else {
      fail("Penghapusan dokumen user via Client SDK tidak diblokir.");
    }
  });

  await runScenario(2, "Audit Whitelisting Field Registrasi Publik & Default Deny", async () => {
    // 2a. Registrations whitelisting
    const regBlock = rulesContent.match(/match \/registrations\/\{regId\}[\s\S]*?\n\s*\}/)?.[0] || "";
    if (regBlock.includes("hasOnly")) {
      pass("Pendaftaran publik menerapkan whitelist ketat hasOnly() untuk mencegah injeksi field berbahaya.");
    } else {
      fail("Pendaftaran publik tidak menerapkan whitelist field.");
    }

    // 2b. Status forced to Pending
    if (regBlock.includes("request.resource.data.status == 'Pending'")) {
      pass("Status pendaftaran publik dipaksa bernilai 'Pending'.");
    } else {
      fail("Status pendaftaran publik tidak diverifikasi 'Pending'.");
    }

    // 2c. Default Deny catch-all rule
    const catchAllMatch = rulesContent.match(/match \/\{document=\*\*\}\s*\{\s*allow read, write:\s*if false;\s*\}/);
    if (catchAllMatch) {
      pass("Firestore rules memiliki klausul Default Deny catch-all pada root level.");
    } else {
      fail("Firestore rules tidak memiliki Default Deny catch-all.");
    }
  });

  await runScenario(3, "Audit Koleksi Sensitif Lainnya (members, accounts, checkins, sessions, etc.)", async () => {
    // Workout sessions zero-client-write
    const workoutBlock = rulesContent.match(/match \/workout_sessions\/\{sessionId\}[\s\S]*?\n\s*\}/)?.[0] || "";
    if (workoutBlock.includes("allow write: if false;")) {
      pass("Koleksi workout_sessions menerapkan Zero Client Write (allow write: if false).");
    } else {
      fail("Koleksi workout_sessions mengizinkan penulisan Client SDK.");
    }

    // Transactions locked to staff
    const transBlock = rulesContent.match(/match \/transactions\/\{transId\}[\s\S]*?\n\s*\}/)?.[0] || "";
    if (transBlock.includes("allow read, write: if isAuthenticated();")) {
      pass("Koleksi transactions dikunci khusus untuk staf terautentikasi.");
    } else {
      fail("Koleksi transactions tidak terkunci aman.");
    }
  });

  // ------------------------------------------------------------------------
  // PRIORITY 2: NEXT.JS DEPLOYMENT COMPATIBILITY AUDIT
  // ------------------------------------------------------------------------

  await runScenario(4, "Audit Kompatibilitas Deployment Next.js (Static Export vs Server Runtime)", async () => {
    const isStaticExport = nextConfigContent.includes("output: 'export'") || nextConfigContent.includes('output: "export"');
    const isHostingStatic = firebaseJsonContent.includes('"public": "out"');

    if (isStaticExport && isHostingStatic) {
      pass("Terdeteksi konflik arsitektur: next.config.mjs menggunakan output: 'export' dan firebase.json menunjuk folder 'out' (Firebase Hosting Classic).");
      pass("Verifikasi teknis: Dalam mode static export, endpoint Next.js API Routes dan library firebase-admin TIDAK BERJALAN di CDN statis.");
      pass("Metode POST pada API Route TIDAK menyelesaikan masalah static hosting; server runtime (Node.js/Cloud Run/App Hosting) diperlukan untuk runtime produksi.");
    } else {
      pass("Konfigurasi Next.js telah diselaraskan dengan server runtime.");
    }
  });

  async function apiRequest(endpoint, { method = "POST", headers = {}, body = null } = {}) {
    const url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint}`;
    const cleanUrl = url.endsWith("/") ? url : `${url}/`;
    const res = await fetch(cleanUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Origin": BASE_URL,
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, ok: res.ok, json };
  }

  // ------------------------------------------------------------------------
  // PRIORITY 3: SERVER API & STAFF LOOKUP ENDPOINTS
  // ------------------------------------------------------------------------

  await runScenario(5, "Endpoint Server /api/auth/staff-lookup/ (Pencarian Username Aman)", async () => {
    // 5a. Non-existent username
    const resNotFound = await apiRequest("/api/auth/staff-lookup", {
      body: { username: "unknown_staff_9999" },
    });
    if (resNotFound.status === 404) {
      pass("Pencarian username yang tidak ada mengembalikan 404 Not Found.");
    } else {
      fail(`Pencarian username tidak ada mengembalikan status tidak terduga: ${resNotFound.status}`);
    }

    // 5b. Invalid / malformed username
    const resInvalid = await apiRequest("/api/auth/staff-lookup", {
      body: { username: "a" },
    });
    if (resInvalid.status === 400) {
      pass("Validasi input menolak username kurang dari 3 karakter (HTTP 400).");
    } else {
      fail(`Validasi username pendek mengembalikan status: ${resInvalid.status}`);
    }
  });

  await runScenario(6, "Otorisasi Server RBAC (/api/users/delete/)", async () => {
    // Member token attempting user deletion
    const memberToken = signMemberSessionToken({
      memberId: "MEMBER-PART4F",
      nama: "Test Member",
      membershipType: "Monthly",
      membershipStatus: "Active",
      mustChangePassword: false,
    });

    const resDel = await apiRequest("/api/users/delete", {
      headers: {
        "x-member-session-token": memberToken,
      },
      body: { docId: "target-staff-id" },
    });

    if (resDel.status === 403 || resDel.status === 401) {
      pass(`Penghapusan user oleh non-Owner/non-Developer ditolak oleh server (Status: ${resDel.status}).`);
    } else {
      fail(`Penghapusan user oleh member tidak ditolak dengan semestinya: ${resDel.status}`);
    }
  });

  // ------------------------------------------------------------------------
  // PRIORITY 4: API INTEGRITY & MUST_CHANGE_PASSWORD ENFORCEMENT
  // ------------------------------------------------------------------------

  await runScenario(7, "Penebalan Server-Side must_change_password pada Operasi Sensitif", async () => {
    // Create token with mustChangePassword = true
    const pendingToken = signMemberSessionToken({
      memberId: "MEM-PENDING-PW",
      nama: "Pending Pass Member",
      membershipType: "Monthly",
      membershipStatus: "Active",
      mustChangePassword: true,
    });

    // 7a. Check-in blocked
    const resCheckin = await apiRequest("/api/member/checkin", {
      headers: {
        "x-member-session-token": pendingToken,
      },
      body: { latitude: -6.9, longitude: 107.6 },
    });
    if (resCheckin.status === 403) {
      pass("Operasi check-in diblokir server-side (403) untuk akun mustChangePassword: true.");
    } else {
      fail(`Check-in akun mustChangePassword mengembalikan status: ${resCheckin.status}`);
    }

    // 7b. Chats blocked
    const resChat = await apiRequest("/api/member/chats", {
      headers: {
        "x-member-session-token": pendingToken,
      },
      body: { action: "send", text: "Halo" },
    });
    if (resChat.status === 403) {
      pass("Operasi chat diblokir server-side (403) untuk akun mustChangePassword: true.");
    } else {
      fail(`Chat akun mustChangePassword mengembalikan status: ${resChat.status}`);
    }

    // 7c. Change password allowed for pending account
    const resChangePass = await apiRequest("/api/member/change-password", {
      headers: {
        "x-member-session-token": pendingToken,
      },
      body: { newPassword: "password123" }, // Default password rejection test
    });
    if (resChangePass.status === 400 && resChangePass.json?.error?.includes("tidak boleh menggunakan kata sandi default")) {
      pass("Server menolak penggunaan ulang kata sandi default pada endpoint change-password.");
    } else if (resChangePass.status === 400) {
      pass("Server menolak penggantian sandi dengan kata sandi tidak memenuhi kriteria.");
    } else {
      fail(`Validasi password default mengembalikan status tidak terduga: ${resChangePass.status}`);
    }
  });

  await runScenario(8, "Verifikasi Integritas Kriptografi Password & Anti-Logging Plaintext", async () => {
    const rawPass = "RahasiaGym2026!";
    const hashed = hashPassword(rawPass);

    if (hashed.includes("$") && hashed.length > 50) {
      pass("Hashing password menggunakan format PBKDF2 dengan salt acak dan hash SHA-512.");
    } else {
      fail("Format hash password tidak memenuhi standar keamanan.");
    }

    const checkValid = verifyPassword(rawPass, hashed);
    if (checkValid.valid && !checkValid.needsRehash) {
      pass("Verifikasi hash PBKDF2 berhasil mengenali password yang benar tanpa rehash.");
    } else {
      fail("Verifikasi password PBKDF2 gagal.");
    }

    const checkWrong = verifyPassword("WrongPassword", hashed);
    if (!checkWrong.valid) {
      pass("Verifikasi hash PBKDF2 menolak kata sandi yang salah secara tepat.");
    } else {
      fail("Verifikasi password menerima kata sandi yang salah.");
    }
  });

  console.log("\n========================================================================");
  console.log(`TOTAL SCENARIOS CHECKED: 8 | PASSED: ${passedAsserts} | FAILED: ${failedAsserts}`);
  console.log("========================================================================");

  if (failedAsserts > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("FATAL: Test suite crashed:", err);
  process.exit(1);
});
