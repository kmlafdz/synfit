import type {
  ExerciseType,
  PoseLandmarks,
  PreparationStatus,
  LiveAnalysisFrame,
  WorkoutSetResult,
} from "./types.ts";
import { THRESHOLDS } from "./thresholds.ts";
import { SquatAnalyzer } from "./squatAnalyzer.ts";
import { PushUpAnalyzer } from "./pushUpAnalyzer.ts";
import { BicepCurlAnalyzer } from "./bicepCurlAnalyzer.ts";

export * from "./types.ts";
export * from "./thresholds.ts";
export * from "./angleUtils.ts";

export const EXERCISE_METADATA: Record<
  ExerciseType,
  {
    name: string;
    description: string;
    primaryMuscle: string;
    targetRepsDefault: number;
    preparationTips: string;
  }
> = {
  squat: {
    name: "Squat",
    description: "Latihan kekuatan kaki dan pinggul dengan gerakan jongkok terarah.",
    primaryMuscle: "Quadriceps & Glutes",
    targetRepsDefault: 12,
    preparationTips: "Posisikan kamera sejajar pinggul/dada, mundur hingga seluruh tubuh terlihat dari kepala hingga kaki.",
  },
  push_up: {
    name: "Push Up",
    description: "Latihan kekuatan tubuh bagian atas dan stabilitas otot inti.",
    primaryMuscle: "Chest & Triceps",
    targetRepsDefault: 10,
    preparationTips: "Letakkan kamera di lantai atau sudut rendah mengarah menyamping agar garis tubuh terlihat jelas.",
  },
  bicep_curl: {
    name: "Bicep Curl",
    description: "Isolasi otot lengan depan dengan menekuk siku secara terkontrol.",
    primaryMuscle: "Biceps Brachii",
    targetRepsDefault: 12,
    preparationTips: "Berdiri tegak menghadap kamera, pastikan bahu, siku, dan pergelangan tangan berada di dalam frame.",
  },
};

/**
 * Checks landmark presence, full body coverage, and camera distance
 */
export function evaluatePreparationStatus(
  landmarks: PoseLandmarks | null | undefined,
  cameraReady: boolean
): PreparationStatus {
  if (!cameraReady) {
    return {
      cameraReady: false,
      poseDetected: false,
      fullBodyVisible: false,
      distanceStatus: "not_detected",
      guidanceMessage: "Kamera belum aktif. Tekan Mulai Kamera untuk persiapan.",
    };
  }

  if (!landmarks || landmarks.length < 29) {
    return {
      cameraReady: true,
      poseDetected: false,
      fullBodyVisible: false,
      distanceStatus: "not_detected",
      guidanceMessage: "Pose not detected. Masuk ke dalam frame kamera.",
    };
  }

  const nose = landmarks[0];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftAnkle = landmarks[27];
  const rightAnkle = landmarks[28];

  const topY = nose?.y ?? Math.min(leftShoulder?.y ?? 0, rightShoulder?.y ?? 0);
  const bottomY = Math.max(leftAnkle?.y ?? 1, rightAnkle?.y ?? 1);
  const bodySpanHeight = bottomY - topY;

  // Check key landmarks visibility
  const shouldersVis = ((leftShoulder?.visibility ?? 0) + (rightShoulder?.visibility ?? 0)) / 2;
  const anklesVis = ((leftAnkle?.visibility ?? 0) + (rightAnkle?.visibility ?? 0)) / 2;

  const poseDetected = shouldersVis >= THRESHOLDS.CAMERA.MIN_VISIBILITY;
  const fullBodyVisible = poseDetected && anklesVis >= THRESHOLDS.CAMERA.MIN_VISIBILITY;

  if (!poseDetected) {
    return {
      cameraReady: true,
      poseDetected: false,
      fullBodyVisible: false,
      distanceStatus: "not_detected",
      guidanceMessage: "Pose not detected. Masuk ke dalam frame kamera.",
    };
  }

  if (bodySpanHeight > THRESHOLDS.CAMERA.TOO_CLOSE_HEIGHT_RATIO) {
    return {
      cameraReady: true,
      poseDetected: true,
      fullBodyVisible: false,
      distanceStatus: "too_close",
      guidanceMessage: "Move farther from the camera. Mundur sedikit agar seluruh tubuh terlihat.",
    };
  }

  if (bodySpanHeight < THRESHOLDS.CAMERA.TOO_FAR_HEIGHT_RATIO) {
    return {
      cameraReady: true,
      poseDetected: true,
      fullBodyVisible: true,
      distanceStatus: "too_far",
      guidanceMessage: "Move closer to the camera. Maju sedikit agar pose lebih akurat.",
    };
  }

  return {
    cameraReady: true,
    poseDetected: true,
    fullBodyVisible,
    distanceStatus: "ideal",
    guidanceMessage: "Posisi ideal. Siap untuk memulai set!",
  };
}

/**
 * Unified Exercise Analyzer Engine Manager
 */
export class ExerciseAnalyzerEngine {
  private currentExercise: ExerciseType;
  private targetReps: number;
  private currentAnalyzer: SquatAnalyzer | PushUpAnalyzer | BicepCurlAnalyzer;

  constructor(exercise: ExerciseType, targetReps: number = 12) {
    this.currentExercise = exercise;
    this.targetReps = targetReps;
    this.currentAnalyzer = this.createAnalyzer(exercise, targetReps);
  }

  private createAnalyzer(
    exercise: ExerciseType,
    targetReps: number
  ): SquatAnalyzer | PushUpAnalyzer | BicepCurlAnalyzer {
    switch (exercise) {
      case "squat":
        return new SquatAnalyzer(targetReps);
      case "push_up":
        return new PushUpAnalyzer(targetReps);
      case "bicep_curl":
        return new BicepCurlAnalyzer(targetReps);
    }
  }

  switchExercise(exercise: ExerciseType, targetReps: number = 12) {
    this.currentExercise = exercise;
    this.targetReps = targetReps;
    this.currentAnalyzer = this.createAnalyzer(exercise, targetReps);
    this.currentAnalyzer.reset();
  }

  resetCurrentSet() {
    this.currentAnalyzer.reset();
  }

  processFrame(
    landmarks: PoseLandmarks | null | undefined,
    timestamp: number,
    cameraReady: boolean
  ): LiveAnalysisFrame {
    const prep = evaluatePreparationStatus(landmarks, cameraReady);

    if (!landmarks || !prep.poseDetected) {
      return {
        exercise: this.currentExercise,
        currentPhase: "READY",
        completedReps: 0,
        targetReps: this.targetReps,
        currentFormScore: 85,
        formCategory: "Good",
        primaryAngle: 0,
        feedbacks: [
          {
            id: "no_pose",
            message: prep.guidanceMessage,
            type: "info",
            timestamp,
          },
        ],
        isRepCompletedThisFrame: false,
        prepStatus: prep,
      };
    }

    return this.currentAnalyzer.process(landmarks, timestamp, prep);
  }

  getSetResult(status: "active" | "completed" | "incomplete" | "cancelled"): WorkoutSetResult {
    return this.currentAnalyzer.getSetResult(status);
  }

  getExerciseType(): ExerciseType {
    return this.currentExercise;
  }
}
