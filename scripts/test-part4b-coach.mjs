/**
 * SYNFIT AI — PART 4B EXERCISE FORM ASSISTANT TEST SUITE
 * Tests pose analysis algorithms, phase transitions, anti-double-counting,
 * landmark confidence thresholds, camera lifecycle, and server storage security.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  ExerciseAnalyzerEngine,
  evaluatePreparationStatus,
  calculateAngle,
  THRESHOLDS,
} from "../src/lib/exerciseAnalyzer/index.ts";

import { SquatAnalyzer } from "../src/lib/exerciseAnalyzer/squatAnalyzer.ts";
import { PushUpAnalyzer } from "../src/lib/exerciseAnalyzer/pushUpAnalyzer.ts";
import { BicepCurlAnalyzer } from "../src/lib/exerciseAnalyzer/bicepCurlAnalyzer.ts";
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

/**
 * Creates a synthetic full-body 33-landmark pose array with custom angles and visibility
 */
function createSyntheticLandmarks({
  kneeAngle = 180,
  elbowAngle = 180,
  visibility = 0.9,
} = {}) {
  const landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0.0,
    visibility,
  }));

  // Head
  landmarks[0] = { x: 0.5, y: 0.2, z: 0.0, visibility };

  // Shoulders (11=left, 12=right)
  landmarks[11] = { x: 0.45, y: 0.35, z: 0.0, visibility };
  landmarks[12] = { x: 0.55, y: 0.35, z: 0.0, visibility };

  // Elbows & Wrists based on elbowAngle (13=left elbow, 15=left wrist)
  const elbowRad = ((180 - elbowAngle) * Math.PI) / 180;
  landmarks[13] = { x: 0.45, y: 0.55, z: 0.0, visibility };
  landmarks[15] = {
    x: 0.45 + 0.2 * Math.sin(elbowRad),
    y: 0.55 + 0.2 * Math.cos(elbowRad),
    z: 0.0,
    visibility,
  };

  // Right arm mirror
  landmarks[14] = { x: 0.55, y: 0.55, z: 0.0, visibility };
  landmarks[16] = {
    x: 0.55 + 0.2 * Math.sin(elbowRad),
    y: 0.55 + 0.2 * Math.cos(elbowRad),
    z: 0.0,
    visibility,
  };

  // Hips (23=left, 24=right)
  landmarks[23] = { x: 0.47, y: 0.55, z: 0.0, visibility };
  landmarks[24] = { x: 0.53, y: 0.55, z: 0.0, visibility };

  // Knees & Ankles based on kneeAngle (25=left knee, 27=left ankle)
  const kneeRad = ((180 - kneeAngle) * Math.PI) / 180;
  landmarks[25] = { x: 0.47, y: 0.70, z: 0.0, visibility };
  landmarks[27] = {
    x: 0.47 + 0.2 * Math.sin(kneeRad),
    y: 0.70 + 0.2 * Math.cos(kneeRad),
    z: 0.0,
    visibility,
  };

  // Right leg mirror
  landmarks[26] = { x: 0.53, y: 0.70, z: 0.0, visibility };
  landmarks[28] = {
    x: 0.53 + 0.2 * Math.sin(kneeRad),
    y: 0.70 + 0.2 * Math.cos(kneeRad),
    z: 0.0,
    visibility,
  };

  return landmarks;
}

/**
 * Feeds a smooth series of frames through an analyzer to mimic realistic 30fps movement
 */
function feedTrajectory(analyzer, angleList, angleProp, startTimestamp, stepMs, prep) {
  let t = startTimestamp;
  let repTriggeredFrame = null;
  let lastFrame = null;

  for (const angle of angleList) {
    const lm = createSyntheticLandmarks({ [angleProp]: angle });
    lastFrame = analyzer.process(lm, t, prep);
    if (lastFrame.isRepCompletedThisFrame) {
      repTriggeredFrame = { ...lastFrame, triggerTimestamp: t };
    }
    t += stepMs;
  }

  return { lastFrame, repTriggeredFrame, endTimestamp: t };
}

async function main() {
  console.log("========================================================================");
  console.log("   SYNFIT AI - PART 4B EXERCISE FORM ASSISTANT HARDENING TEST SUITE");
  console.log("========================================================================\n");

  const prep = {
    cameraReady: true,
    poseDetected: true,
    fullBodyVisible: true,
    distanceStatus: "ideal",
    guidanceMessage: "Ready",
  };

  // 1. Squat, push-up, dan bicep curl: Siklus Fase Gerakan & Penghitungan Repetisi
  await runTest(1, "Squat, push-up, dan bicep curl: Siklus Fase & Rep Counter", async () => {
    // 1a. SQUAT: STANDING -> DESCENDING -> BOTTOM -> ASCENDING -> STANDING
    const squatAnalyzer = new SquatAnalyzer(10);
    squatAnalyzer.reset();
    let t = 1000;

    // Standing initial
    const initSquat = squatAnalyzer.process(createSyntheticLandmarks({ kneeAngle: 175 }), t, prep);
    if (initSquat.currentPhase !== "STANDING") {
      throw new Error(`Squat phase expected STANDING, got: ${initSquat.currentPhase}`);
    }

    // Smooth descent -> bottom (angles: 160, 140, 120, 100, 85, 85)
    t += 200;
    const descentRes = feedTrajectory(squatAnalyzer, [160, 140, 120, 100, 85, 85], "kneeAngle", t, 200, prep);
    if (descentRes.lastFrame.currentPhase !== "BOTTOM") {
      throw new Error(`Squat phase expected BOTTOM, got: ${descentRes.lastFrame.currentPhase}`);
    }

    // Smooth ascent -> standing (angles: 100, 125, 145, 160, 175, 175)
    t = descentRes.endTimestamp;
    const ascentRes = feedTrajectory(squatAnalyzer, [100, 125, 145, 160, 175, 175], "kneeAngle", t, 200, prep);
    if (!ascentRes.repTriggeredFrame) {
      throw new Error("Squat rep completion frame was not triggered during ascent to standing");
    }
    if (ascentRes.lastFrame.completedReps !== 1) {
      throw new Error(`Expected completedReps 1, got ${ascentRes.lastFrame.completedReps}`);
    }

    // 1b. PUSH-UP: UP -> DOWN -> UP
    const pushUpAnalyzer = new PushUpAnalyzer(10);
    pushUpAnalyzer.reset();
    t = 1000;

    const initPushUp = pushUpAnalyzer.process(createSyntheticLandmarks({ elbowAngle: 170 }), t, prep);
    if (initPushUp.currentPhase !== "UP") {
      throw new Error(`Push-up phase expected UP, got: ${initPushUp.currentPhase}`);
    }

    // Down: 150, 120, 95, 80, 80
    t += 200;
    const puDown = feedTrajectory(pushUpAnalyzer, [150, 120, 95, 80, 80], "elbowAngle", t, 200, prep);
    if (puDown.lastFrame.currentPhase !== "DOWN") {
      throw new Error(`Push-up phase expected DOWN, got: ${puDown.lastFrame.currentPhase}`);
    }

    // Up: 105, 130, 155, 170, 170
    t = puDown.endTimestamp;
    const puUp = feedTrajectory(pushUpAnalyzer, [105, 130, 155, 170, 170], "elbowAngle", t, 200, prep);
    if (!puUp.repTriggeredFrame) {
      throw new Error("Push-up rep completion frame was not triggered on return to UP");
    }
    if (puUp.lastFrame.completedReps !== 1) {
      throw new Error(`Expected completed push-up rep count 1, got ${puUp.lastFrame.completedReps}`);
    }

    // 1c. BICEP CURL: EXTENDED -> CURLING -> CONTRACTED -> EXTENDED
    const curlAnalyzer = new BicepCurlAnalyzer(10);
    curlAnalyzer.reset();
    t = 1000;

    const initCurl = curlAnalyzer.process(createSyntheticLandmarks({ elbowAngle: 165 }), t, prep);
    if (initCurl.currentPhase !== "EXTENDED") {
      throw new Error(`Curl phase expected EXTENDED, got: ${initCurl.currentPhase}`);
    }

    // Curl up to contracted peak: 140, 110, 80, 50, 45, 45
    t += 200;
    const curlUp = feedTrajectory(curlAnalyzer, [140, 110, 80, 50, 45, 45], "elbowAngle", t, 200, prep);
    if (curlUp.lastFrame.currentPhase !== "CONTRACTED") {
      throw new Error(`Curl phase expected CONTRACTED, got: ${curlUp.lastFrame.currentPhase}`);
    }

    // Lower down to extension: 75, 105, 135, 155, 165, 165
    t = curlUp.endTimestamp;
    const curlDown = feedTrajectory(curlAnalyzer, [75, 105, 135, 155, 165, 165], "elbowAngle", t, 200, prep);
    if (!curlDown.repTriggeredFrame) {
      throw new Error("Bicep curl rep completion frame was not triggered on return to EXTENDED");
    }
    if (curlDown.lastFrame.completedReps !== 1) {
      throw new Error(`Expected completed bicep curl rep count 1, got ${curlDown.lastFrame.completedReps}`);
    }
  });

  // 2. Pose tidak terdeteksi atau landmark tidak memadai
  await runTest(2, "Pose tidak terdeteksi atau landmark tidak memadai", async () => {
    const engine = new ExerciseAnalyzerEngine("squat", 10);

    // 2a. Null or empty landmarks
    const nullFrame = engine.processFrame(null, 1000, true);
    if (nullFrame.prepStatus.poseDetected) throw new Error("Expected poseDetected: false for null landmarks");
    if (nullFrame.completedReps !== 0) throw new Error("Should not count reps when pose is missing");

    // 2b. Landmarks with low visibility (< 0.35)
    const lowVisLandmarks = createSyntheticLandmarks({ kneeAngle: 85, visibility: 0.1 });
    const lowVisFrame = engine.processFrame(lowVisLandmarks, 1500, true);
    const hasLowConfidenceFeedback = lowVisFrame.feedbacks.some(
      (f) => f.id === "low_landmark_confidence" || f.id === "no_pose"
    );
    if (!hasLowConfidenceFeedback) {
      throw new Error("Expected low confidence feedback when landmark visibility is 0.1");
    }
    if (lowVisFrame.isRepCompletedThisFrame) {
      throw new Error("Must never complete a rep when landmark visibility is low");
    }
  });

  // 3. Penghitungan repetisi ganda (Anti-Double Counting)
  await runTest(3, "Penghitungan repetisi ganda (Anti-Double Counting)", async () => {
    const squatAnalyzer = new SquatAnalyzer(10);
    squatAnalyzer.reset();
    let t = 1000;

    // Complete Rep 1 cleanly
    feedTrajectory(squatAnalyzer, [175, 150, 120, 95, 85, 85], "kneeAngle", t, 200, prep);
    t += 1400;
    const ascent = feedTrajectory(squatAnalyzer, [100, 125, 145, 160, 175, 175], "kneeAngle", t, 200, prep);
    if (ascent.lastFrame.completedReps !== 1) throw new Error("Failed to record first rep");

    // Spam standing frames immediately (50ms interval < MIN_REP_TIME_MS 1200ms)
    t = ascent.endTimestamp;
    for (let i = 0; i < 5; i++) {
      t += 50;
      const spamFrame = squatAnalyzer.process(createSyntheticLandmarks({ kneeAngle: 175 }), t, prep);
      if (spamFrame.completedReps !== 1 || spamFrame.isRepCompletedThisFrame) {
        throw new Error(`Double counting occurred on frame ${i + 1}! Completed reps jumped to ${spamFrame.completedReps}`);
      }
    }
  });

  // 4. Penggantian gerakan saat sesi berjalan
  await runTest(4, "Penggantian gerakan saat sesi berjalan", async () => {
    const engine = new ExerciseAnalyzerEngine("squat", 12);
    if (engine.getExerciseType() !== "squat") throw new Error("Initial exercise should be squat");

    engine.switchExercise("bicep_curl", 10);
    if (engine.getExerciseType() !== "bicep_curl") throw new Error("Exercise type should switch to bicep_curl");

    const initialCurlFrame = engine.processFrame(createSyntheticLandmarks({ elbowAngle: 160 }), 1000, true);
    if (initialCurlFrame.exercise !== "bicep_curl") throw new Error("Frame exercise should be bicep_curl");
    if (initialCurlFrame.currentPhase !== "EXTENDED") throw new Error("Curl starting phase should be EXTENDED");
    if (initialCurlFrame.completedReps !== 0) throw new Error("New exercise reps should start at 0");
  });

  // 5. Kamera ditolak atau tidak tersedia
  await runTest(5, "Kamera ditolak atau tidak tersedia", async () => {
    // Camera not ready status
    const notReady = evaluatePreparationStatus(null, false);
    if (notReady.cameraReady !== false) throw new Error("Expected cameraReady: false");
    if (!notReady.guidanceMessage.includes("Kamera belum aktif")) {
      throw new Error("Missing guidance for inactive camera");
    }

    // Verify AIFormCoach handles camera error states
    const coachFilePath = path.join(__dirname, "../src/components/AIFormCoach.tsx");
    const coachCode = fs.readFileSync(coachFilePath, "utf8");
    if (!coachCode.includes("NotAllowedError") || !coachCode.includes("NotFoundError")) {
      throw new Error("AIFormCoach missing NotAllowedError or NotFoundError camera handling");
    }
  });

  // 6. Penghentian kamera setelah sesi selesai
  await runTest(6, "Penghentian kamera setelah sesi selesai", async () => {
    const coachFilePath = path.join(__dirname, "../src/components/AIFormCoach.tsx");
    const coachCode = fs.readFileSync(coachFilePath, "utf8");

    // Must call track.stop() on each track
    if (!coachCode.includes("mediaStreamRef.current.getTracks().forEach((track) => track.stop())")) {
      throw new Error("Missing camera track.stop() cleanup in stopCamera()");
    }
    // Must cleanup on unmount
    if (!coachCode.includes("return () => {\n      stopCamera();\n    };")) {
      throw new Error("Missing useEffect unmount cleanup calling stopCamera()");
    }
    // Must NOT contain direct client SDK firestore write fallback
    if (coachCode.includes("addDoc(collection(db, \"workout_sessions\")")) {
      throw new Error("Insecure client SDK Firestore addDoc fallback detected in AIFormCoach!");
    }
  });

  // 7. Request penyimpanan tanpa autentikasi (Server Security)
  await runTest(7, "Request penyimpanan tanpa autentikasi (Server Security)", async () => {
    const res = await fetch("http://localhost:3000/api/workout-sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        duration_minutes: 15,
        exercise_count: 1,
        completed_sets: 3,
        incomplete_sets: 0,
        total_reps: 36,
        average_form_score: 92,
      }),
    });

    if (res.status !== 401) {
      throw new Error(`Expected HTTP 401 Unauthorized for request without session token, got: ${res.status}`);
    }
    const data = await res.json();
    if (data.success !== false) {
      throw new Error("Expected success: false in unauthenticated response");
    }
  });

  // 8. Pemalsuan member_id (Server Security Guard Contract)
  await runTest(8, "Pemalsuan member_id (Server enforces verified session identity)", async () => {
    // Read route implementation to verify context override contract
    const routeFilePath = path.join(__dirname, "../src/app/api/workout-sessions/route.ts");
    const routeCode = fs.readFileSync(routeFilePath, "utf8");

    // Must enforce context.memberId and override spoofed client body
    if (!routeCode.includes("if (context.role === \"MEMBER\")") ||
        !routeCode.includes("effectiveMemberId = context.memberId!")) {
      throw new Error("Server route does not enforce context.memberId override against client body spoofing!");
    }

    // Must use server-side Zod validation schema
    if (!routeCode.includes("workoutSessionPayloadSchema.safeParse")) {
      throw new Error("Server route does not use workoutSessionPayloadSchema for input validation!");
    }
  });

  // 9. Input metrik tidak valid (Zod Schema Validation)
  await runTest(9, "Input metrik tidak valid (Zod validation rejections)", async () => {
    // 9a. Negative reps
    const negRepsResult = workoutSessionPayloadSchema.safeParse({
      duration_minutes: 10,
      exercise_count: 1,
      completed_sets: 1,
      incomplete_sets: 0,
      total_reps: -25, // INVALID!
      average_form_score: 85,
    });
    if (negRepsResult.success) {
      throw new Error("Expected Zod schema to reject negative total_reps");
    }

    // 9b. Absurdly high reps (> 5000)
    const highRepsResult = workoutSessionPayloadSchema.safeParse({
      duration_minutes: 10,
      exercise_count: 1,
      completed_sets: 1,
      incomplete_sets: 0,
      total_reps: 99999, // INVALID!
      average_form_score: 85,
    });
    if (highRepsResult.success) {
      throw new Error("Expected Zod schema to reject total_reps > 5000");
    }

    // 9c. Invalid negative duration
    const negDurationResult = workoutSessionPayloadSchema.safeParse({
      duration_minutes: -10, // INVALID!
      exercise_count: 1,
      completed_sets: 1,
      incomplete_sets: 0,
      total_reps: 20,
      average_form_score: 85,
    });
    if (negDurationResult.success) {
      throw new Error("Expected Zod schema to reject negative duration_minutes");
    }

    // 9d. Form score outside 0-100 bounds
    const invalidScoreResult = workoutSessionPayloadSchema.safeParse({
      duration_minutes: 15,
      exercise_count: 1,
      completed_sets: 1,
      incomplete_sets: 0,
      total_reps: 20,
      average_form_score: 150, // INVALID!
    });
    if (invalidScoreResult.success) {
      throw new Error("Expected Zod schema to reject average_form_score > 100");
    }

    // 9e. Valid payload accepts cleanly
    const validResult = workoutSessionPayloadSchema.safeParse({
      duration_minutes: 15,
      exercise_count: 2,
      completed_sets: 4,
      incomplete_sets: 0,
      total_reps: 48,
      average_form_score: 91.5,
      overall_feedback: "Sesi latihan diselesaikan dengan baik.",
      exercises: [
        {
          name: "Squat",
          completed_sets: 2,
          total_reps: 24,
          average_form_score: 92,
        },
      ],
    });
    if (!validResult.success) {
      throw new Error(`Expected valid payload to pass, got error: ${JSON.stringify(validResult.error)}`);
    }
  });

  // 10. Regresi pada login, dashboard, dan chatbot
  await runTest(10, "Regresi pada login, dashboard, dan chatbot", async () => {
    const memberLoginPath = path.join(__dirname, "../src/app/api/auth/member-login/route.ts");
    const dashboardPath = path.join(__dirname, "../src/app/member/dashboard/page.tsx");
    const aiKnowledgePath = path.join(__dirname, "../src/app/api/ai/knowledge/route.ts");
    const assistantComponentPath = path.join(__dirname, "../src/components/MemberAIAssistant.tsx");

    if (!fs.existsSync(memberLoginPath)) throw new Error("member-login route missing");
    if (!fs.existsSync(dashboardPath)) throw new Error("member dashboard missing");
    if (!fs.existsSync(aiKnowledgePath)) throw new Error("ai knowledge route missing");
    if (!fs.existsSync(assistantComponentPath)) throw new Error("MemberAIAssistant component missing");

    const dashContent = fs.readFileSync(dashboardPath, "utf8");
    if (!dashContent.includes("AIFormCoach")) throw new Error("AIFormCoach missing from dashboard");
    if (!dashContent.includes("MemberAIAssistant")) throw new Error("MemberAIAssistant missing from dashboard");
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
