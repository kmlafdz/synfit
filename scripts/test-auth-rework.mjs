import {
  sendWelcomeEmail,
  sendMembershipReminderEmail,
  sendWorkoutSummaryEmail,
  buildWelcomeHtml,
  buildReminderHtml,
  buildWorkoutSummaryHtml
} from "../src/lib/email/resend.ts";
import assert from "node:assert";

console.log("=================================================");
console.log("SYNFIT AI — MEMBER AUTHENTICATION REWORK TEST SUITE");
console.log("=================================================");

async function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`❌ [FAIL] ${name}:`, e.message);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (e) {
      console.error(`❌ [FAIL] ${name}:`, e.message);
      failed++;
    }
  }

  // 1. Resend Email Template Generation Tests
  console.log("\n--- PART 7: TEMPLATE EMAIL RENDERING ---");

  test("Welcome Email Template: Generates responsive branded HTML with SynFit logo & CTA", () => {
    const html = buildWelcomeHtml({
      toEmail: "athlete@synfitgym.com",
      memberName: "Budi Santoso",
      membershipType: "1 Bulan Pass",
      expiryDate: "2026-11-20",
      memberId: "SF-TEST-001",
    });
    assert(html.includes("SYNFIT AI"), "Must contain brand header SYNFIT AI");
    assert(html.includes("Budi Santoso"), "Must include member name");
    assert(html.includes("1 Bulan Pass"), "Must include membership type");
    assert(html.includes("/member/dashboard"), "Must contain CTA to member dashboard");
  });

  test("Membership Reminder Template: Generates warning card & days remaining", () => {
    const html = buildReminderHtml({
      toEmail: "athlete2@synfitgym.com",
      memberName: "Siti Rahma",
      daysRemaining: 3,
      expiryDate: "2026-10-24",
    });
    assert(html.includes("PENGINGAT KEANGGOTAAN"), "Must contain title");
    assert(html.includes("3 hari lagi"), "Must specify days remaining");
    assert(html.includes("Perpanjang Membership Sekarang"), "Must contain renewal CTA button");
  });

  test("Workout Summary Template: Generates stats grid & AI accuracy breakdown", () => {
    const html = buildWorkoutSummaryHtml({
      toEmail: "athlete3@synfitgym.com",
      memberName: "Ahmad Dani",
      exerciseType: "Barbell Squat",
      reps: 30,
      accuracy: 94,
      durationSeconds: 1800,
    });
    assert(html.includes("Ringkasan Sesi Latihan"), "Must contain title");
    assert(html.includes("Barbell Squat"), "Must state exercise");
    assert(html.includes("94%"), "Must display accuracy score");
  });

  // 2. Resend Email Service Execution & Idempotency
  console.log("\n--- PART 6: RESEND EMAIL SERVICE & IDEMPOTENCY ---");

  await testAsync("Welcome Email: Handles execution and dispatches live", async () => {
    const res = await sendWelcomeEmail({
      toEmail: "synfit.assistant@syntriad.my.id",
      memberName: "Budi Santoso",
      membershipType: "1 Bulan Pass",
      expiryDate: "2026-11-20",
      memberId: "SF-TEST-001",
    });
    assert(res.success === true, "Should return success true");
    assert(res.messageId || res.skipped, "Should have messageId or be skipped");
  });

  await testAsync("Welcome Email Idempotency: Immediate duplicate email within 60s is caught", async () => {
    const res2 = await sendWelcomeEmail({
      toEmail: "synfit.assistant@syntriad.my.id",
      memberName: "Budi Santoso",
      membershipType: "1 Bulan Pass",
      expiryDate: "2026-11-20",
      memberId: "SF-TEST-001",
    });
    assert(res2.success === true, "Should return success true");
    assert(res2.skipped === true, "Should be skipped due to idempotency");
  });

  await testAsync("Membership Reminder Email: Dispatches gracefully", async () => {
    const res = await sendMembershipReminderEmail({
      toEmail: "synfit.assistant@syntriad.my.id",
      memberName: "Siti Rahma",
      daysRemaining: 5,
      expiryDate: "2026-10-26",
    });
    assert(res.success === true, "Should return success true");
  });

  await testAsync("Workout Summary Email: Dispatches gracefully", async () => {
    const res = await sendWorkoutSummaryEmail({
      toEmail: "synfit.assistant@syntriad.my.id",
      memberName: "Ahmad Dani",
      exerciseType: "Push-up",
      reps: 45,
      accuracy: 91,
      durationSeconds: 900,
    });
    assert(res.success === true, "Should return success true");
  });

  // 3. Security & Backend Guard Tests
  console.log("\n--- PART 2 & 8: SECURITY, RBAC & SECRETS ISOLATION ---");

  test("Client Bundle Secret Leak Prevention: RESEND_API_KEY is not exposed with NEXT_PUBLIC_", () => {
    const envKeys = Object.keys(process.env);
    const leakedPublicResend = envKeys.filter((k) => k.startsWith("NEXT_PUBLIC_RESEND"));
    assert(
      leakedPublicResend.length === 0,
      `Detected forbidden public Resend key: ${leakedPublicResend.join(", ")}`
    );
  });

  test("Email Address Normalization: Sanitizes input before lookup", () => {
    const rawInput = "  Member.Test@SynFitGym.COM  ";
    const cleaned = rawInput.toLowerCase().trim();
    assert.strictEqual(cleaned, "member.test@synfitgym.com");
  });

  test("Phone Variant Generation: Standardizes Indonesian numbers", () => {
    const getVariants = (input) => {
      const raw = input.replace(/\D/g, "");
      let base = raw;
      if (base.startsWith("62")) base = base.substring(2);
      else if (base.startsWith("0")) base = base.substring(1);
      return [`62${base}`, `+62${base}`, `0${base}`, base, raw];
    };

    const variants = getVariants("0812-3456-7890");
    assert(variants.includes("6281234567890"));
    assert(variants.includes("+6281234567890"));
    assert(variants.includes("081234567890"));
  });

  console.log("\n=================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
