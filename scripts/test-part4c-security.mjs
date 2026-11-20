/**
 * SYNFIT AI — PART 4C FIRESTORE SECURITY & LEGACY PASSWORD REMEDIATION TEST SUITE
 * Evaluates Firestore Security Rules, PBKDF2 password migration, session guard authorization,
 * spoofing defense, and regression integrity.
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

import { workoutSessionPayloadSchema } from "../src/lib/ai/validation.ts";

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
  console.log("   SYNFIT AI - PART 4C FIRESTORE SECURITY & PASSWORD REMEDIATION SUITE");
  console.log("========================================================================\n");

  const rulesContent = fs.readFileSync(path.join(__dirname, "../firestore.rules"), "utf8");

  // 1. Pengguna tanpa autentikasi mencoba membaca data privat
  await runTest(1, "Pengguna tanpa autentikasi mencoba membaca data privat", async () => {
    // Check that member_accounts rules strictly deny unauthenticated access
    const memberAccountsMatch = rulesContent.match(/match \/member_accounts\/\{accountId\}[\s\S]*?allow read, write: if ([^;]+);/);
    if (!memberAccountsMatch) {
      throw new Error("Missing match /member_accounts rule in firestore.rules");
    }
    const condition = memberAccountsMatch[1].trim();
    if (condition === "true") {
      throw new Error("Critical Vulnerability: member_accounts allows unauthenticated read!");
    }
    if (condition !== "isAuthenticated()" && condition !== "request.auth != null") {
      throw new Error(`Unexpected condition for member_accounts: ${condition}`);
    }

    // Check that workout_sessions rules block client writes
    const workoutMatch = rulesContent.match(/match \/workout_sessions\/\{sessionId\}[\s\S]*?allow write: if ([^;]+);/);
    if (!workoutMatch) {
      throw new Error("Missing match /workout_sessions rule in firestore.rules");
    }
    if (workoutMatch[1].trim() !== "false") {
      throw new Error("Vulnerability: workout_sessions does not block client writes (expected: false)!");
    }
  });

  // 2. Anggota A mencoba membaca data anggota B
  await runTest(2, "Anggota A mencoba membaca data anggota B (Ownership Assertion)", async () => {
    const memberAContext = {
      userId: "acc-member-A",
      role: "MEMBER",
      memberId: "member-A-123",
      requestId: "req-1",
      timestamp: new Date().toISOString(),
    };

    // Member A reading Member A data -> Allowed
    try {
      assertMemberOwnership(memberAContext, "member-A-123");
    } catch (e) {
      throw new Error(`Legitimate ownership assertion failed: ${e.message}`);
    }

    // Member A reading Member B data -> Must throw AIAuthorizationError
    let blocked = false;
    try {
      assertMemberOwnership(memberAContext, "member-B-999");
    } catch (err) {
      blocked = true;
      if (!err.message.includes("You cannot access or modify another member's data")) {
        throw new Error(`Unexpected error message: ${err.message}`);
      }
    }
    if (!blocked) {
      throw new Error("Security Violation: Member A successfully read Member B's data!");
    }
  });

  // 3. Anggota A mencoba mengubah data anggota B
  await runTest(3, "Anggota A mencoba mengubah data anggota B (Password Route Binding)", async () => {
    const changePassRoute = fs.readFileSync(path.join(__dirname, "../src/app/api/member/change-password/route.ts"), "utf8");

    // Route must resolve caller identity strictly from verified session (resolveMemberSession or resolveAIContext)
    const hasSessionResolver = changePassRoute.includes("resolveAIContext(request)") || changePassRoute.includes("resolveMemberSession");
    if (!hasSessionResolver) {
      throw new Error("change-password route does not use session resolver for caller verification!");
    }

    // Route must use session memberId, NOT client-supplied body ID
    const hasMemberBinding = changePassRoute.includes("where(\"member_id\", \"==\", context.memberId)") || changePassRoute.includes("where(\"member_id\", \"==\", session.memberId)");
    if (!hasMemberBinding) {
      throw new Error("change-password route does not enforce session memberId binding!");
    }
  });

  // 4. Anggota mencoba memalsukan role admin
  await runTest(4, "Anggota mencoba memalsukan role admin (Role Guard & HMAC Anti-Tamper)", async () => {
    const memberContext = {
      userId: "acc-member-1",
      role: "MEMBER",
      memberId: "mem-1",
      requestId: "req-2",
      timestamp: new Date().toISOString(),
    };

    // Attempting admin-only operation
    let blocked = false;
    try {
      assertRole(memberContext, ["ADMIN", "OWNER", "DEVELOPER"]);
    } catch (err) {
      blocked = true;
      if (!err.message.includes("Access denied: Role 'MEMBER' is not authorized")) {
        throw new Error(`Unexpected role guard error: ${err.message}`);
      }
    }
    if (!blocked) {
      throw new Error("Security Violation: MEMBER was allowed past admin assertRole guard!");
    }

    // Attempting to forge an HMAC session token with role: "ADMIN"
    const legitToken = signMemberSessionToken({
      accountId: "acc-1",
      memberId: "mem-1",
      whatsapp: "0812345678",
      name: "Attacker",
    });

    const [payloadB64, sig] = legitToken.split(".");
    const decodedPayload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    decodedPayload.role = "ADMIN"; // Tampering!
    const forgedPayloadB64 = Buffer.from(JSON.stringify(decodedPayload)).toString("base64url");
    const tamperedToken = `${forgedPayloadB64}.${sig}`;

    const verified = verifyMemberSessionToken(tamperedToken);
    if (verified !== null) {
      throw new Error("Security Violation: Tampered HMAC session token was accepted by server!");
    }
  });

  // 5. Client mencoba menulis langsung ke collection yang hanya boleh diakses server
  await runTest(5, "Client mencoba menulis langsung ke collection server-only", async () => {
    // 5a. workout_sessions rule check
    if (!rulesContent.includes("match /workout_sessions/{sessionId}")) {
      throw new Error("Missing workout_sessions rule");
    }
    if (!rulesContent.includes("allow write: if false;")) {
      throw new Error("workout_sessions must specify 'allow write: if false;' to block direct client writes");
    }

    // 5b. Unauthenticated HTTP POST to /api/workout-sessions must return 401
    const res = await fetch("http://localhost:3000/api/workout-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        duration_minutes: 15,
        total_reps: 30,
        average_form_score: 90,
      }),
    });
    if (res.status !== 401) {
      throw new Error(`Expected HTTP 401 Unauthorized for client direct write without token, got: ${res.status}`);
    }
  });

  // 6. Admin mengakses fungsi yang memang diizinkan
  await runTest(6, "Admin mengakses fungsi yang memang diizinkan", async () => {
    const adminContext = {
      userId: "admin-uid-123",
      role: "ADMIN",
      requestId: "req-admin",
      timestamp: new Date().toISOString(),
    };
    const ownerContext = {
      userId: "owner-uid-456",
      role: "OWNER",
      requestId: "req-owner",
      timestamp: new Date().toISOString(),
    };
    const devContext = {
      userId: "dev-uid-789",
      role: "DEVELOPER",
      requestId: "req-dev",
      timestamp: new Date().toISOString(),
    };

    assertRole(adminContext, ["ADMIN", "OWNER", "DEVELOPER"]);
    assertRole(ownerContext, ["ADMIN", "OWNER", "DEVELOPER"]);
    assertRole(devContext, ["ADMIN", "OWNER", "DEVELOPER"]);
  });

  // 7. Endpoint server menolak sesi tidak valid
  await runTest(7, "Endpoint server menolak sesi tidak valid (HMAC verification)", async () => {
    // 7a. Corrupt token format
    if (verifyMemberSessionToken("not-a-token") !== null) {
      throw new Error("Accepted malformed token");
    }

    // 7b. Expired token
    const pastTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const expiredPayload = {
      accountId: "acc-1",
      memberId: "mem-1",
      whatsapp: "0812345678",
      name: "Expired",
      iat: pastTimestamp - 3600,
      exp: pastTimestamp,
    };
    const expPayloadB64 = Buffer.from(JSON.stringify(expiredPayload)).toString("base64url");
    const secret = crypto.createHash("sha256").update((process.env.FIREBASE_PROJECT_ID || "synfit-areta-fitness-default-secret-seed") + "-session-secret-salt").digest("hex");
    const expSig = crypto.createHmac("sha256", secret).update(expPayloadB64).digest("hex");
    const expiredToken = `${expPayloadB64}.${expSig}`;

    if (verifyMemberSessionToken(expiredToken) !== null) {
      throw new Error("Accepted expired member session token!");
    }
  });

  // 8. Login anggota lama dan proses migrasi password (PBKDF2 & Legacy Plaintext)
  await runTest(8, "Login anggota lama dan proses migrasi password (PBKDF2 Hash)", async () => {
    const plainLegacyPassword = "userpassword123";

    // 8a. Verify legacy plaintext detects need for rehash
    const checkLegacy = verifyPassword(plainLegacyPassword, plainLegacyPassword);
    if (!checkLegacy.valid || !checkLegacy.needsRehash) {
      throw new Error("verifyPassword failed to flag legacy plaintext password for rehash");
    }

    // 8b. Generate modern PBKDF2 hash
    const modernHash = hashPassword(plainLegacyPassword);
    if (!modernHash.includes("$")) {
      throw new Error("hashPassword did not produce 'salt$hash' format");
    }

    // 8c. Verify modern PBKDF2 hash
    const checkModern = verifyPassword(plainLegacyPassword, modernHash);
    if (!checkModern.valid) {
      throw new Error("verifyPassword failed on valid PBKDF2 hash");
    }
    if (checkModern.needsRehash) {
      throw new Error("verifyPassword incorrectly flagged modern PBKDF2 hash for rehash");
    }

    // 8d. Incorrect password rejection
    const checkWrong = verifyPassword("wrongpassword", modernHash);
    if (checkWrong.valid) {
      throw new Error("verifyPassword accepted incorrect password!");
    }

    // 8e. Timing attack resilience: lengths match
    const [salt, hexHash] = modernHash.split("$");
    if (salt.length !== 32 || hexHash.length !== 64) {
      throw new Error(`Unexpected salt/hash length: salt=${salt.length}, hash=${hexHash.length}`);
    }
  });

  // 9. Fitur check-in dan penyimpanan workout tetap berfungsi
  await runTest(9, "Fitur check-in dan penyimpanan workout tetap berfungsi", async () => {
    // 9a. Workout payload schema validation
    const validWorkout = workoutSessionPayloadSchema.safeParse({
      duration_minutes: 20,
      exercise_count: 1,
      completed_sets: 3,
      incomplete_sets: 0,
      total_reps: 36,
      average_form_score: 94,
      overall_feedback: "Gerakan konsisten dan stabil.",
      exercises: [
        {
          name: "Push-up",
          completed_sets: 3,
          total_reps: 36,
          average_form_score: 94,
        },
      ],
    });
    if (!validWorkout.success) {
      throw new Error(`Valid workout session failed schema validation: ${JSON.stringify(validWorkout.error)}`);
    }

    // 9b. Checkin collection rules allow validated create or strict staff-only/server-only write
    if (!rulesContent.includes("match /checkins/{checkinId}")) {
      throw new Error("Missing checkins rule");
    }
    const hasValidRule = rulesContent.includes("request.resource.data.member_id is string") || rulesContent.includes("allow read, write: if isAuthenticated();");
    if (!hasValidRule) {
      throw new Error("Checkin rule is neither restricted to authenticated staff nor enforces type check");
    }
  });

  // 10. Chatbot anggota dan dashboard tidak mengalami regresi
  await runTest(10, "Chatbot anggota dan dashboard tidak mengalami regresi", async () => {
    const aiKnowledgeRoute = path.join(__dirname, "../src/app/api/ai/knowledge/route.ts");
    const memberDashboard = path.join(__dirname, "../src/app/member/dashboard/page.tsx");
    const changePasswordRoute = path.join(__dirname, "../src/app/api/member/change-password/route.ts");

    if (!fs.existsSync(aiKnowledgeRoute)) throw new Error("AI knowledge route missing");
    if (!fs.existsSync(memberDashboard)) throw new Error("Member dashboard missing");
    if (!fs.existsSync(changePasswordRoute)) throw new Error("Change password route missing");

    const dashContent = fs.readFileSync(memberDashboard, "utf8");
    if (!dashContent.includes("/api/member/change-password")) {
      throw new Error("Dashboard does not reference /api/member/change-password");
    }
    if (dashContent.includes("doc(db, \"member_accounts\"")) {
      throw new Error("Regression: Dashboard still directly accesses member_accounts via client SDK!");
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
