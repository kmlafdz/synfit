import type {
  PoseLandmarks,
  PushUpPhase,
  FormFeedback,
  LiveAnalysisFrame,
  PreparationStatus,
  WorkoutSetResult,
} from "./types.ts";
import { THRESHOLDS } from "./thresholds.ts";
import { calculateAngle, AngleSmoother } from "./angleUtils.ts";
import { RepCounter } from "./repCounter.ts";
import { FormScorer } from "./formScorer.ts";

export class PushUpAnalyzer {
  private phase: PushUpPhase = "UP";
  private repCounter: RepCounter;
  private formScorer: FormScorer;
  private elbowSmoother = new AngleSmoother(0.4);
  private bodyAlignmentSmoother = new AngleSmoother(0.4);

  private lowestElbowAngle: number = 180;
  private targetReps: number = 12;
  private setStartTime: number = 0;

  private accumulatedFeedbacks: Set<string> = new Set();
  private romRatings: number[] = [];
  private alignmentRatings: number[] = [];
  private tempoRatings: number[] = [];

  constructor(targetReps: number = 12) {
    this.targetReps = targetReps;
    this.repCounter = new RepCounter(THRESHOLDS.PUSH_UP.MIN_REP_TIME_MS);
    this.formScorer = new FormScorer();
  }

  reset() {
    this.phase = "UP";
    this.repCounter.reset();
    this.formScorer.reset();
    this.elbowSmoother.reset();
    this.bodyAlignmentSmoother.reset();
    this.lowestElbowAngle = 180;
    this.accumulatedFeedbacks.clear();
    this.setStartTime = performance.now();
    this.romRatings = [];
    this.alignmentRatings = [];
    this.tempoRatings = [];
  }

  process(
    landmarks: PoseLandmarks,
    timestamp: number,
    prepStatus: PreparationStatus
  ): LiveAnalysisFrame {
    if (!this.setStartTime) this.setStartTime = timestamp;

    const feedbacks: FormFeedback[] = [];
    let isRepCompleted = false;

    // Landmarks:
    // Shoulder: 11 (left), 12 (right)
    // Elbow: 13 (left), 14 (right)
    // Wrist: 15 (left), 16 (right)
    // Hip: 23 (left), 24 (right)
    // Ankle: 27 (left), 28 (right)
    const leftVis = (landmarks[11]?.visibility ?? 0) + (landmarks[13]?.visibility ?? 0) + (landmarks[15]?.visibility ?? 0);
    const rightVis = (landmarks[12]?.visibility ?? 0) + (landmarks[14]?.visibility ?? 0) + (landmarks[16]?.visibility ?? 0);

    const useLeft = leftVis >= rightVis;
    const shoulder = useLeft ? landmarks[11] : landmarks[12];
    const elbow = useLeft ? landmarks[13] : landmarks[14];
    const wrist = useLeft ? landmarks[15] : landmarks[16];
    const hip = useLeft ? landmarks[23] : landmarks[24];
    const ankle = useLeft ? landmarks[27] : landmarks[28];

    if (!shoulder || !elbow || !wrist) {
      return this.buildFrame(180, feedbacks, isRepCompleted, prepStatus);
    }

    const minVis = THRESHOLDS.CAMERA.MIN_VISIBILITY;
    const isVisible =
      (shoulder.visibility ?? 1) >= minVis &&
      (elbow.visibility ?? 1) >= minVis &&
      (wrist.visibility ?? 1) >= minVis;

    if (!isVisible) {
      feedbacks.push({
        id: "low_landmark_confidence",
        message: "Landmark lengan/siku kurang jelas. Posisikan kamera agar lengan terlihat jelas dari samping.",
        type: "info",
        timestamp,
      });
      return this.buildFrame(this.elbowSmoother.getValue() || 180, feedbacks, false, {
        ...prepStatus,
        guidanceMessage: "Kualitas landmark rendah. Pastikan sudut kamera menangkap lengan dengan baik.",
      });
    }

    const rawElbowAngle = calculateAngle(shoulder, elbow, wrist);
    const elbowAngle = this.elbowSmoother.smooth(rawElbowAngle);

    let framePenalty = 0;

    // Body alignment check: shoulder -> hip -> ankle
    if (hip && ankle) {
      const rawBodyAngle = calculateAngle(shoulder, hip, ankle);
      const bodyAngle = this.bodyAlignmentSmoother.smooth(rawBodyAngle);

      if (bodyAngle < THRESHOLDS.PUSH_UP.BODY_ALIGNMENT_MIN) {
        feedbacks.push({
          id: "hip_sag",
          message: "Jaga pinggul tetap sejajar, hindari melengkung.",
          type: "warning",
          timestamp,
        });
        framePenalty += 20;
        this.alignmentRatings.push(65);
      } else {
        feedbacks.push({
          id: "body_straight",
          message: "Pertahankan posisi tubuh lurus.",
          type: "good",
          timestamp,
        });
        this.alignmentRatings.push(95);
      }
    }

    // STATE MACHINE: UP -> DOWN -> UP
    switch (this.phase) {
      case "UP":
        if (elbowAngle < THRESHOLDS.PUSH_UP.TOP_ELBOW_MIN - 15) {
          this.phase = "DOWN";
          this.lowestElbowAngle = elbowAngle;
        }
        break;

      case "DOWN":
        if (elbowAngle < this.lowestElbowAngle) {
          this.lowestElbowAngle = elbowAngle;
        }

        // Check if returning to UP lockout
        if (elbowAngle >= THRESHOLDS.PUSH_UP.TOP_ELBOW_MIN) {
          // Rep Completed!
          const repAccepted = this.repCounter.increment(timestamp);
          if (repAccepted) {
            isRepCompleted = true;

            let romScore = 90;
            if (this.lowestElbowAngle <= THRESHOLDS.PUSH_UP.BOTTOM_ELBOW_MAX) {
              feedbacks.push({
                id: "depth_good",
                message: "Kedalaman push up optimal (sudut siku <= 90°).",
                type: "good",
                timestamp,
              });
              romScore = 100;
            } else if (this.lowestElbowAngle <= THRESHOLDS.PUSH_UP.BOTTOM_ACCEPTABLE_MAX) {
              feedbacks.push({
                id: "depth_ok",
                message: "Kedalaman push up cukup baik.",
                type: "good",
                timestamp,
              });
              romScore = 80;
            } else {
              feedbacks.push({
                id: "depth_shallow",
                message: "Turunkan tubuh lebih rendah hingga dada mendekati lantai.",
                type: "warning",
                timestamp,
              });
              romScore = 60;
            }

            this.romRatings.push(romScore);
            this.tempoRatings.push(85);

            this.formScorer.recordRepScore({
              rangeOfMotion: romScore,
              alignment: Math.max(50, 100 - framePenalty),
              posture: 90,
              tempo: 85,
              consistency: 90,
            });
          }

          // Cycle back to UP
          this.phase = "UP";
          this.lowestElbowAngle = 180;
        }
        break;
    }

    feedbacks.forEach((f) => this.accumulatedFeedbacks.add(f.message));
    this.formScorer.updateLiveScore(framePenalty);

    return this.buildFrame(elbowAngle, feedbacks, isRepCompleted, prepStatus);
  }

  private buildFrame(
    primaryAngle: number,
    feedbacks: FormFeedback[],
    isRepCompleted: boolean,
    prepStatus: PreparationStatus
  ): LiveAnalysisFrame {
    const score = this.formScorer.updateLiveScore();
    return {
      exercise: "push_up",
      currentPhase: this.phase,
      completedReps: this.repCounter.getCount(),
      targetReps: this.targetReps,
      currentFormScore: score,
      formCategory: FormScorer.getCategory(score),
      primaryAngle,
      feedbacks,
      isRepCompletedThisFrame: isRepCompleted,
      prepStatus,
    };
  }

  getSetResult(status: "active" | "completed" | "incomplete" | "cancelled"): WorkoutSetResult {
    const duration = Math.round((performance.now() - this.setStartTime) / 1000);
    const score = this.formScorer.getOverallSetScore();

    const avgRom = this.romRatings.length
      ? this.romRatings.reduce((a, b) => a + b, 0) / this.romRatings.length
      : 80;
    const avgAlign = this.alignmentRatings.length
      ? this.alignmentRatings.reduce((a, b) => a + b, 0) / this.alignmentRatings.length
      : 80;

    let summaryAdvice = "Postur push up solid. Pastikan tubuh tetap lurus dari kepala hingga tumit.";
    if (avgRom < 75) {
      summaryAdvice = "Coba turunkan dada lebih dekat ke lantai pada setiap repetisi untuk jangkauan gerak maksimal.";
    }

    return {
      exercise: "push_up",
      setNumber: 1,
      targetReps: this.targetReps,
      completedReps: this.repCounter.getCount(),
      formScore: score,
      durationSeconds: Math.max(1, duration),
      status,
      feedbacks: Array.from(this.accumulatedFeedbacks),
      metrics: {
        rangeOfMotion: avgRom >= 85 ? "Good" : "Needs Improvement",
        alignment: avgAlign >= 85 ? "Good" : "Fair",
        tempo: "Good",
      },
      summaryAdvice,
    };
  }
}
