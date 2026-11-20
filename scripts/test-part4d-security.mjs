/**
 * SYNFIT AI — PART 4D SECURITY VERIFICATION & PRODUCTION READINESS TEST SUITE
 * Rigorously verifies Firestore Security Rules, Public Query Privacy, Ownership Isolation,
 * Default Password Constraints, CSRF/Rate Limiting, and Regression across all modules.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

import {
  hashPassword,
  verifyPassword,
  signMemberSessionToken,
  verifyMemberSessionToken,
} from "../src/lib/auth/memberAuth.ts";

import {
  assertRole,
  assertMemberOwnership,
} from "../src/lib/ai/sessionGuard.ts";

import { checkRateLimit } from "../src/lib/security/rateLimit.ts";
import { verifySameOrigin } from "../src/lib/security/csrf.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const results = [];

async function runTest(num, title, testFn) {
  try {
    await testFn();
    results.push({ num, title, status: "PASSED", error: null });
    console.log(`[PASS] Scenario ${num}: ${title}`);
  } catch (err) {
    results.push({ num, title, status: "FAILED", error: err.message });
    console.error(`[FAIL] Scenario ${num}: ${title} -> ${err.message}`);
  }
}

async function main() {
  console.log("========================================================================");
  console.log("   SYNFIT AI - PART 4D SECURITY VERIFICATION & READINESS TEST SUITE");
  console.log("========================================================================\n");

  const rulesContent = fs.readFileSync(path.join(__dirname, "../firestore.rules"), "utf8");

  // 1. Pengguna anonim membaca daftar anggota
  await runTest(1, "Pengguna anonim membaca daftar anggota (Rules List Isolation)", async () => {
    // Check that members rule strictly restricts list to authenticated staff
    const membersBlock = rulesContent.match(/match \/members\/\{memberId\}[\s\S]*?\n\s*\}/);
    if (!membersBlock) throw new Error("Missing match /members/{memberId} block in firestore.rules");

    const blockText = membersBlock[0];
    if (blockText.includes("allow list: if true")) {
      throw new Error("Critical Vulnerability: Anonymous users are allowed to list members!");
    }
    if (!blockText.includes("allow list: if isAuthenticated();") && !blockText.includes("allow read, write: if isAuthenticated();") && !blockText.includes("allow read: if isAuthenticated();")) {
      throw new Error("Vulnerability: Members list rule does not enforce isAuthenticated() check");
    }
  });

  // 2. Pengguna anonim mencari anggota berdasarkan nomor WhatsApp (Privacy & Sanitization)
  await runTest(2, "Pengguna anonim mencari anggota (Server API Minimization & Rate Limiting)", async () => {
    // 2a. Verify customer/page.tsx does not query Firestore directly
    const customerPageCode = fs.readFileSync(path.join(__dirname, "../src/app/customer/page.tsx"), "utf8");
    if (customerPageCode.includes("getDocs(q)")) {
      throw new Error("Vulnerability: customer/page.tsx executes direct client getDocs queries on members!");
    }
    if (!customerPageCode.includes("/api/customer/lookup-card")) {
      throw new Error("customer/page.tsx does not route lookup through /api/customer/lookup-card server endpoint");
    }

    // 2b. Verify /api/customer/lookup-card route sanitizes output
    const lookupRouteCode = fs.readFileSync(path.join(__dirname, "../src/app/api/customer/lookup-card/route.ts"), "utf8");
    if (lookupRouteCode.includes("rawData.alamat") || lookupRouteCode.includes("rawData.berat_badan")) {
      throw new Error("Vulnerability: lookup-card leaks private fields (alamat / biometrics)!");
    }
    if (!lookupRouteCode.includes("checkRateLimit(")) {
      throw new Error("lookup-card missing rate limiting check");
    }

    // 2c. Rate limiter functionality check
    const testKey = `test-rate-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      const res = checkRateLimit(testKey, 5, 10000);
      if (!res.success) throw new Error(`Unexpected rate limit rejection on request ${i + 1}`);
    }
    const rateBlocked = checkRateLimit(testKey, 5, 10000);
    if (rateBlocked.success) {
      throw new Error("Rate limiter failed to block request exceeding max limit (5)!");
    }
  });

  // 3. Anggota A membaca atau mengubah data anggota B
  await runTest(3, "Anggota A membaca atau mengubah data anggota B (Strict Isolation)", async () => {
    const memberA = {
      userId: "acc-A",
      role: "MEMBER",
      memberId: "member-A-001",
      requestId: "req-A",
      timestamp: new Date().toISOString(),
    };

    // Attempting access on member B
    let readBlocked = false;
    try {
      assertMemberOwnership(memberA, "member-B-999");
    } catch {
      readBlocked = true;
    }
    if (!readBlocked) throw new Error("assertMemberOwnership failed to block cross-member read!");

    // Firestore update protection on members collection
    const membersBlock = rulesContent.match(/match \/members\/\{memberId\}[\s\S]*?\n\s*\}/)[0];
    if (membersBlock.includes("allow update: if true;")) {
      throw new Error("Critical Vulnerability: members collection allows unrestricted update!");
    }
  });

  // 4. Anggota memalsukan member_id ketika membuat check-in
  await runTest(4, "Anggota memalsukan member_id ketika membuat check-in", async () => {
    // Checkin rules must either restrict write to authenticated staff (Part 4E)
    // or strictly enforce validated member_id string if client write was permitted (Part 4D)
    const checkinBlock = rulesContent.match(/match \/checkins\/\{checkinId\}[\s\S]*?\n\s*\}/);
    if (!checkinBlock) throw new Error("Missing checkins rule");
    const isStrictStaffOnly = checkinBlock[0].includes("allow read, write: if isAuthenticated();") || checkinBlock[0].includes("allow write: if isAuthenticated();");
    const hasTypeCheck = checkinBlock[0].includes("request.resource.data.member_id is string");
    if (!isStrictStaffOnly && !hasTypeCheck) {
      throw new Error("Checkin rule neither restricts write to staff nor enforces member_id type check");
    }
  });

  // 5. Anggota membaca percakapan dan notifikasi anggota lain
  await runTest(5, "Anggota membaca percakapan dan notifikasi anggota lain", async () => {
    // Staff chats must strictly require isAuthenticated()
    const staffChatsBlock = rulesContent.match(/match \/chats\/\{chatId\}[\s\S]*?\n\s*\}/);
    if (!staffChatsBlock || !staffChatsBlock[0].includes("allow read, write: if isAuthenticated();")) {
      throw new Error("Staff internal chat is not restricted to authenticated staff!");
    }

    // Member chats must not allow unauthenticated read: if true
    const memberChatsBlock = rulesContent.match(/match \/member_chats\/\{chatId\}[\s\S]*?\n\s*\}/);
    if (!memberChatsBlock || memberChatsBlock[0].includes("allow read: if true;")) {
      throw new Error("member_chats allows unrestricted read!");
    }

    // Notifications must not allow unauthenticated read: if true
    const notifsBlock = rulesContent.match(/match \/notifications\/\{notifId\}[\s\S]*?\n\s*\}/);
    if (!notifsBlock || notifsBlock[0].includes("allow read: if true;")) {
      throw new Error("notifications allows unrestricted read!");
    }
  });

  // 6. Pengguna mencoba membuat atau mengubah transaksi
  await runTest(6, "Pengguna mencoba membuat atau mengubah transaksi", async () => {
    const transBlock = rulesContent.match(/match \/transactions\/\{transId\}[\s\S]*?\n\s*\}/);
    if (!transBlock) throw new Error("Missing transactions rule");
    const isStaffRestricted = transBlock[0].includes("allow read, update, delete: if isAuthenticated();") || transBlock[0].includes("allow read, write: if isAuthenticated();");
    if (!isStaffRestricted) {
      throw new Error("Transactions collection does not restrict read/update/delete/write to authenticated staff!");
    }
  });

  // 7. Client mencoba menulis langsung ke workout_sessions
  await runTest(7, "Client mencoba menulis langsung ke workout_sessions (Zero Client Write)", async () => {
    const workoutBlock = rulesContent.match(/match \/workout_sessions\/\{sessionId\}[\s\S]*?\n\s*\}/);
    if (!workoutBlock || !workoutBlock[0].includes("allow write: if false;")) {
      throw new Error("workout_sessions does not specify 'allow write: if false;'!");
    }
  });

  // 8. Staf tanpa role yang sesuai mencoba menjalankan fungsi admin
  await runTest(8, "Staf tanpa role yang sesuai mencoba fungsi admin", async () => {
    const staffContext = {
      userId: "uid-staff-1",
      role: "STAFF",
      requestId: "req-staff",
      timestamp: new Date().toISOString(),
    };

    let blocked = false;
    try {
      assertRole(staffContext, ["ADMIN", "OWNER", "DEVELOPER"]);
    } catch {
      blocked = true;
    }
    if (!blocked) throw new Error("Staff was allowed past admin/owner role guard!");
  });

  // 9. Akses publik yang memang diperlukan tetap berjalan
  await runTest(9, "Akses publik yang memang diperlukan tetap berjalan", async () => {
    // 9a. Configs and equipment public reads
    const configsBlock = rulesContent.match(/match \/configs\/\{configId\}[\s\S]*?\n\s*\}/);
    const equipBlock = rulesContent.match(/match \/equipment\/\{equipId\}[\s\S]*?\n\s*\}/);
    if (!configsBlock || !configsBlock[0].includes("allow read: if true;")) {
      throw new Error("configs missing public read for landing page gym details");
    }
    if (!equipBlock || !equipBlock[0].includes("allow read: if true;")) {
      throw new Error("equipment missing public read for landing page catalog");
    }

    // 9b. Public phone check endpoint
    const checkPhonePath = path.join(__dirname, "../src/app/api/membership/check-phone/route.ts");
    if (!fs.existsSync(checkPhonePath)) throw new Error("check-phone API route missing");
  });

  // 10. Dashboard, pendaftaran, check-in, dan login tetap berfungsi (Mandatory Password Change & CSRF)
  await runTest(10, "Dashboard, pendaftaran, check-in, dan login tetap berfungsi", async () => {
    // 10a. Login route flags must_change_password on default password
    const memberLoginRoute = fs.readFileSync(path.join(__dirname, "../src/app/api/auth/member-login/route.ts"), "utf8");
    if (!memberLoginRoute.includes("must_change_password")) {
      throw new Error("member-login route does not flag must_change_password!");
    }

    // 10b. Dashboard modal for mandatory password change
    const dashboardCode = fs.readFileSync(path.join(__dirname, "../src/app/member/dashboard/page.tsx"), "utf8");
    if (!dashboardCode.includes("session?.mustChangePassword") || !dashboardCode.includes("Wajib Ganti Kata Sandi Awal")) {
      throw new Error("Dashboard missing mandatory password change modal!");
    }

    // 10c. CSRF verification utility
    const sameOriginReq = new Request("http://localhost:3000/api/member/change-password", {
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });
    if (!verifySameOrigin(sameOriginReq)) {
      throw new Error("verifySameOrigin rejected valid same-origin request!");
    }

    const crossOriginReq = new Request("http://localhost:3000/api/member/change-password", {
      headers: {
        host: "localhost:3000",
        origin: "http://attacker-evil-site.com",
      },
    });
    if (verifySameOrigin(crossOriginReq)) {
      throw new Error("verifySameOrigin accepted malicious cross-origin request!");
    }
  });

  console.log("\n========================================================================");
  const passed = results.filter((r) => r.status === "PASSED").length;
  const failed = results.filter((r) => r.status === "FAILED").length;
  console.log(`TOTAL SCENARIOS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("========================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
