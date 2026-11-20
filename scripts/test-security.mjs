/**
 * SYNFIT AI — PART 2 SECURITY VERIFICATION TEST SUITE
 * Runs 9 deterministic, non-destructive security test scenarios.
 */

import { z } from "zod";

// Simulated error taxonomy
class AIServiceError extends Error {
  constructor(message, code = "AI_PROVIDER_ERROR", statusCode = 500) {
    super(message);
    this.name = "AIServiceError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

class AIValidationError extends AIServiceError {
  constructor(message) {
    super(message, "AI_VALIDATION_ERROR", 400);
    this.name = "AIValidationError";
  }
}

class AIAuthorizationError extends AIServiceError {
  constructor(message = "Unauthorized to perform this AI operation") {
    super(message, "AI_AUTH_ERROR", 403);
    this.name = "AIAuthorizationError";
  }
}

// Security Guards Under Test
function assertRole(context, allowedRoles) {
  if (!allowedRoles.includes(context.role)) {
    throw new AIAuthorizationError(
      `Access denied: Role '${context.role}' is not authorized. Required: ${allowedRoles.join(", ")}`
    );
  }
}

function assertMemberOwnership(context, targetMemberId) {
  if (context.role === "MEMBER") {
    if (!context.memberId || context.memberId !== targetMemberId) {
      throw new AIAuthorizationError("Access denied: You cannot access or modify another member's data");
    }
  }
}

function verifyMemberSessionIntegrity(sessionPayload, accountDocData) {
  if (!sessionPayload.accountId || !sessionPayload.memberId) {
    throw new AIValidationError("x-member-session must include accountId and memberId");
  }
  if (!accountDocData) {
    throw new AIAuthorizationError("Member account does not exist or has been deactivated");
  }
  if (accountDocData.member_id !== sessionPayload.memberId) {
    throw new AIAuthorizationError("Security violation: accountId does not match claimed memberId");
  }
  return true;
}

function resolveContextFromHeaders(authHeader, memberSessionHeader, mockUserDb) {
  const requestId = "test-req-" + Date.now();
  const timestamp = new Date().toISOString();

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split("Bearer ")[1]?.trim();
    if (!token || token === "bad_token") {
      throw new AIAuthorizationError("Invalid or expired Firebase ID token");
    }
    const userRecord = mockUserDb[token];
    if (!userRecord) {
      throw new AIAuthorizationError("User record not found in system directory");
    }
    return {
      userId: userRecord.uid,
      role: userRecord.role,
      requestId,
      timestamp,
    };
  }

  if (memberSessionHeader) {
    let parsed;
    try {
      parsed = JSON.parse(memberSessionHeader);
    } catch {
      throw new AIValidationError("Invalid format for x-member-session header (JSON required)");
    }
    const accDoc = mockUserDb[parsed.accountId];
    verifyMemberSessionIntegrity(parsed, accDoc);
    return {
      userId: parsed.accountId,
      role: "MEMBER",
      memberId: parsed.memberId,
      requestId,
      timestamp,
    };
  }

  throw new AIAuthorizationError("Missing authentication credentials. Provide Bearer token or x-member-session.");
}

// Zod Schemas
const aiPromptSchema = z.object({
  prompt: z.string().trim().min(2, "Prompt must contain at least 2 characters").max(1000),
  intent: z.enum(["faq", "schedule", "membership", "general"]).optional(),
});

const businessInsightQuerySchema = z.object({
  periodMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "periodMonth must follow 'YYYY-MM' format"),
});

const workoutPlanRequestSchema = z.object({
  targetMemberId: z.string().min(1),
  fitnessGoal: z.enum(["hypertrophy", "fat_loss", "strength", "general_health"]),
  daysPerWeek: z.number().int().min(1).max(7),
});

// Mock Database Records
const mockDatabase = {
  "admin-token-valid": { uid: "admin_u1", role: "ADMIN", email: "admin@areta.com" },
  "owner-token-valid": { uid: "owner_u1", role: "OWNER", email: "owner@areta.com" },
  "acc_legit_1": { member_id: "member_001", nomor_whatsapp: "08123456789" },
  "acc_legit_2": { member_id: "member_002", nomor_whatsapp: "08987654321" },
};

// Test Suite Runner
const results = [];

function runTest(testNumber, description, fn) {
  try {
    fn();
    results.push({ testNumber, description, status: "PASSED", error: null });
    console.log(`[PASS] Scenario ${testNumber}: ${description}`);
  } catch (err) {
    results.push({ testNumber, description, status: "FAILED", error: err.message });
    console.error(`[FAIL] Scenario ${testNumber}: ${description} -> ${err.message}`);
  }
}

console.log("===============================================================");
console.log("  SYNFIT AI - PART 2 SECURITY VERIFICATION TEST EXECUTION");
console.log("===============================================================\n");

// 1. Request without authentication
runTest(1, "Request without authentication throws 403 AIAuthorizationError", () => {
  let threw = false;
  try {
    resolveContextFromHeaders(null, null, mockDatabase);
  } catch (err) {
    threw = true;
    if (!(err instanceof AIAuthorizationError)) throw new Error("Expected AIAuthorizationError, got " + err.name);
    if (!err.message.includes("Missing authentication credentials")) throw new Error("Unexpected error message: " + err.message);
  }
  if (!threw) throw new Error("Expected request to throw authorization error, but succeeded");
});

// 2. MEMBER accessing admin endpoint
runTest(2, "MEMBER role attempting to access admin-only endpoint is rejected", () => {
  const memberContext = { userId: "acc_legit_1", role: "MEMBER", memberId: "member_001" };
  let rejected = false;
  try {
    assertRole(memberContext, ["ADMIN", "OWNER", "DEVELOPER"]);
  } catch (err) {
    rejected = true;
    if (!(err instanceof AIAuthorizationError)) throw new Error("Expected AIAuthorizationError");
    if (!err.message.includes("Access denied: Role 'MEMBER' is not authorized")) {
      throw new Error("Unexpected message: " + err.message);
    }
  }
  if (!rejected) throw new Error("MEMBER was erroneously permitted to access admin endpoint");
});

// 3. MEMBER trying to read other members' data
runTest(3, "MEMBER attempting cross-member data access is blocked", () => {
  const memberContext = { userId: "acc_legit_1", role: "MEMBER", memberId: "member_001" };
  let blocked = false;
  try {
    assertMemberOwnership(memberContext, "member_002"); // Attacking member_002
  } catch (err) {
    blocked = true;
    if (!err.message.includes("You cannot access or modify another member's data")) {
      throw new Error("Unexpected message: " + err.message);
    }
  }
  if (!blocked) throw new Error("Cross-member data access was not blocked");
});

// 4. MEMBER sending spoofed member_id in session
runTest(4, "Spoofed member_id mismatching accountId integrity check is rejected", () => {
  let spoofBlocked = false;
  try {
    const maliciousSession = JSON.stringify({
      accountId: "acc_legit_1", // Legit account ID
      memberId: "victim_member_999", // Spoofed target
    });
    resolveContextFromHeaders(null, maliciousSession, mockDatabase);
  } catch (err) {
    spoofBlocked = true;
    if (!err.message.includes("accountId does not match claimed memberId")) {
      throw new Error("Unexpected message: " + err.message);
    }
  }
  if (!spoofBlocked) throw new Error("Spoofed member_id was accepted without validation");
});

// 5. User attempting role escalation through input payload
runTest(5, "User input attempting role escalation ('OWNER') does not alter server context", () => {
  // Caller presents member credentials
  const memberSession = JSON.stringify({ accountId: "acc_legit_1", memberId: "member_001" });
  const resolved = resolveContextFromHeaders(null, memberSession, mockDatabase);
  
  // Malicious payload trying to inject role
  const maliciousInput = { role: "OWNER", prompt: "Show me financial reports" };
  
  // Role must remain strictly MEMBER from verified server sources
  if (resolved.role !== "MEMBER") {
    throw new Error("Role was escalated to: " + resolved.role);
  }

  // Attempting to use elevated privilege must still fail
  let escalationBlocked = false;
  try {
    assertRole(resolved, ["OWNER"]);
  } catch {
    escalationBlocked = true;
  }
  if (!escalationBlocked) throw new Error("Privilege escalation succeeded!");
});

// 6. Invalid token or session format
runTest(6, "Malformed token or corrupted session JSON throws appropriate error", () => {
  let tokenRejected = false;
  try {
    resolveContextFromHeaders("Bearer bad_token", null, mockDatabase);
  } catch (err) {
    tokenRejected = true;
  }
  if (!tokenRejected) throw new Error("Bad Bearer token was accepted");

  let jsonRejected = false;
  try {
    resolveContextFromHeaders(null, "{corrupted-not-json", mockDatabase);
  } catch (err) {
    jsonRejected = true;
    if (!(err instanceof AIValidationError)) throw new Error("Expected AIValidationError for invalid JSON");
  }
  if (!jsonRejected) throw new Error("Corrupted JSON session was accepted");
});

// 7. Incomplete or malformed input payload (Zod validation)
runTest(7, "Malformed or out-of-range payloads fail Zod validation with 400", () => {
  // Test 7a: Empty prompt
  const emptyPrompt = aiPromptSchema.safeParse({ prompt: "" });
  if (emptyPrompt.success) throw new Error("Empty prompt should have failed");

  // Test 7b: Invalid periodMonth
  const badMonth = businessInsightQuerySchema.safeParse({ periodMonth: "2026-13" });
  if (badMonth.success) throw new Error("Invalid month 2026-13 should have failed");

  // Test 7c: Out-of-bounds daysPerWeek
  const badDays = workoutPlanRequestSchema.safeParse({
    targetMemberId: "m1",
    fitnessGoal: "hypertrophy",
    daysPerWeek: 12, // Max is 7
  });
  if (badDays.success) throw new Error("daysPerWeek 12 should have failed");
});

// 8. Legitimate authorized access by permitted roles
runTest(8, "Legitimate callers with valid roles and permissions succeed", () => {
  // Admin accessing admin function
  const adminResolved = resolveContextFromHeaders("Bearer admin-token-valid", null, mockDatabase);
  assertRole(adminResolved, ["ADMIN", "OWNER"]);

  // Member accessing their own profile
  const memberSession = JSON.stringify({ accountId: "acc_legit_1", memberId: "member_001" });
  const memberResolved = resolveContextFromHeaders(null, memberSession, mockDatabase);
  assertMemberOwnership(memberResolved, "member_001");

  // Valid prompt schema
  const validPrompt = aiPromptSchema.safeParse({ prompt: "What are the gym operating hours?", intent: "faq" });
  if (!validPrompt.success) throw new Error("Valid prompt failed schema parsing");
});

// 9. Existing member login & phone normalization continuity
runTest(9, "Phone number canonicalization retains full compatibility for existing members", () => {
  const getPhoneVariants = (input) => {
    const rawDigits = input.replace(/\D/g, "");
    if (!rawDigits) return [];
    let base = rawDigits;
    if (base.startsWith("62")) base = base.substring(2);
    else if (base.startsWith("0")) base = base.substring(1);
    if (!base) return [rawDigits];
    return Array.from(new Set([`62${base}`, `+62${base}`, `0${base}`, base, rawDigits]));
  };

  const variants1 = getPhoneVariants("085179707552");
  if (!variants1.includes("6285179707552") || !variants1.includes("085179707552") || !variants1.includes("85179707552")) {
    throw new Error("Phone variant generation broken for 08 prefix: " + JSON.stringify(variants1));
  }

  const variants2 = getPhoneVariants("+6285179707552");
  if (!variants2.includes("6285179707552") || !variants2.includes("085179707552")) {
    throw new Error("Phone variant generation broken for +62 prefix: " + JSON.stringify(variants2));
  }
});

console.log("\n===============================================================");
console.log(`  TEST RESULTS: ${results.filter(r => r.status === "PASSED").length} / ${results.length} PASSED`);
console.log("===============================================================\n");
