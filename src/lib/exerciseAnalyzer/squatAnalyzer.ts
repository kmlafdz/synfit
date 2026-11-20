import type {
  PoseLandmarks,
  SquatPhase,
  FormFeedback,
  LiveAnalysisFrame,
  PreparationStatus,
  WorkoutSetResult,
} from "./types.ts";
import { THRESHOLDS } from "./thresholds.ts";
import { calculateAngle, calculateTorsoAngle, AngleSmoother } from "./angleUtils.ts";
import { RepCounter } from "./repCounter.ts";
import { FormScorer } from "./formScorer.ts";

export class SquatAnalyzer {
  private phase: SquatPhase = "STANDING";
  private repCounter: RepCounter;
  private formScorer: FormScorer;
  private kneeSmoother = new AngleSmoother(0.4);
  private hipSmoother = new AngleSmoother(0.4);

  private descentStartTime: number = 0;
  private bottomStartTime: number = 0;
  private lowestKneeAngle: number = 180;
  private targetReps: number = 12;

  private accumulatedFeedbacks: Set<string> = new Set();
  private setStartTime: number = 0;
  private romRatings: number[] = [];
  private alignmentRatings: number[] = [];
  private tempoRatings: number[] = [];

  constructor(targetReps: number = 12) {
    this.targetReps = targetReps;
    this.repCounter = new RepCounter(THRESHOLDS.SQUAT.MIN_REP_TIME_MS);
    this.formScorer = new FormScorer();
  }

  reset() {
    this.phase = "STANDING";
    this.repCounter.reset();
    this.formScorer.reset();
    this.kneeSmoother.reset();
    this.hipSmoother.reset();
    this.descentStartTime = 0;
    this.bottomStartTime = 0;
    this.lowestKneeAngle = 180;
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

    // MediaPipe landmarks:
    // Left: shoulder=11, hip=23, knee=25, ankle=27
    // Right: shoulder=12, hip=24, knee=26, ankle=28
    const leftHip = landmarks[23];
    const leftKnee = landmarks[25];
    const leftAnkle = landmarks[27];
    const leftShoulder = landmarks[11];

    const rightHip = landmarks[24];
    const rightKnee = landmarks[26];
    const rightAnkle = landmarks[28];
    const rightShoulder = landmarks[12];

    // Determine better visible side
    const leftVis = (leftHip?.visibility ?? 0) + (leftKnee?.visibility ?? 0) + (leftAnkle?.visibility ?? 0);
    const rightVis = (rightHip?.visibility ?? 0) + (rightKnee?.visibility ?? 0) + (rightAnkle?.visibility ?? 0);

    const useLeft = leftVis >= rightVis;
    const hip = useLeft ? leftHip : rightHip;
    const knee = useLeft ? leftKnee : rightKnee;
    const ankle = useLeft ? leftAnkle : rightAnkle;
    const shoulder = useLeft ? leftShoulder : rightShoulder;

    if (!hip || !knee || !ankle || !shoulder) {
      return this.buildFrame(180, feedbacks, isRepCompleted, prepStatus);
    }

    const minVis = THRESHOLDS.CAMERA.MIN_VISIBILITY;
    const isVisible =
      (hip.visibility ?? 1) >= minVis &&
      (knee.visibility ?? 1) >= minVis &&
      (ankle.visibility ?? 1) >= minVis;

    if (!isVisible) {
      feedbacks.push({
        id: "low_landmark_confidence",
        message: "Landmark kaki kurang jelas. Posisikan kamera agar pinggul, lutut, dan pergelangan kaki terlihat.",
        type: "info",
        timestamp,
      });
      return this.buildFrame(this.kneeSmoother.getValue() || 180, feedbacks, false, {
        ...prepStatus,
        guidanceMessage: "Kualitas landmark rendah. Pastikan tubuh terlihat penuh.",
      });
    }

    const rawKneeAngle = calculateAngle(hip, knee, ankle);
    const rawHipAngle = calculateAngle(shoulder, hip, knee);
    const kneeAngle = this.kneeSmoother.smooth(rawKneeAngle);
    const hipAngle = this.hipSmoother.smooth(rawHipAngle);
    const torsoIncline = calculateTorsoAngle(shoulder, hip);

    let framePenalty = 0;

    // Posture check: back tilt
    if (torsoIncline > THRESHOLDS.SQUAT.BACK_INCLINE_MAX) {
      feedbacks.push({
        id: "back_lean",
        message: "Jaga posisi punggung tetap tegak.",
        type: "warning",
        timestamp,
      });
      framePenalty += 20;
    }

    // Knee alignment check (knee tracking over toes)
    const kneeAlignmentDelta = Math.abs(knee.x - ankle.x);
    if (kneeAlignmentDelta < 0.08) {
      feedbacks.push({
        id: "knee_align_good",
        message: "Posisi lutut sudah baik.",
        type: "good",
        timestamp,
      });
    }

    // STATE MACHINE: STANDING -> DESCENDING -> BOTTOM -> ASCENDING -> STANDING
    switch (this.phase) {
      case "STANDING":
        if (kneeAngle < THRESHOLDS.SQUAT.DESCENDING_TRIGGER) {
          this.phase = "DESCENDING";
          this.descentStartTime = timestamp;
          this.lowestKneeAngle = kneeAngle;
        }
        break;

      case "DESCENDING":
        if (kneeAngle < this.lowestKneeAngle) {
          this.lowestKneeAngle = kneeAngle;
        }

        // Check if reached bottom
        if (kneeAngle <= THRESHOLDS.SQUAT.BOTTOM_ACCEPTABLE_MAX) {
          this.phase = "BOTTOM";
          this.bottomStartTime = timestamp;

          // Check tempo during descent
          const descentDuration = timestamp - this.descentStartTime;
          if (descentDuration < THRESHOLDS.SQUAT.DESCENT_MIN_TIME_MS) {
            feedbacks.push({
              id: "tempo_fast",
              message: "Gerakan turun terlalu cepat. Kontrol tempo.",
              type: "warning",
              timestamp,
            });
            framePenalty += 15;
            this.tempoRatings.push(65);
          } else {
            this.tempoRatings.push(95);
          }
        } else if (kneeAngle > THRESHOLDS.SQUAT.STANDING_KNEE_MIN - 5) {
          // Aborted before reaching bottom
          this.phase = "STANDING";
        }
        break;

      case "BOTTOM":
        if (kneeAngle < this.lowestKneeAngle) {
          this.lowestKneeAngle = kneeAngle;
        }

        // Ascending trigger
        if (kneeAngle > THRESHOLDS.SQUAT.BOTTOM_ACCEPTABLE_MAX + 10) {
          this.phase = "ASCENDING";
        }
        break;

      case "ASCENDING":
        // Back to standing lock
        if (kneeAngle >= THRESHOLDS.SQUAT.STANDING_KNEE_MIN) {
          // Rep completed!
          const repAccepted = this.repCounter.increment(timestamp);
          if (repAccepted) {
            isRepCompleted = true;

            // Evaluate rep depth & ROM
            let romScore = 95;
            if (this.lowestKneeAngle <= THRESHOLDS.SQUAT.BOTTOM_OPTIMAL_MAX) {
              feedbacks.push({
                id: "depth_perfect",
                message: "Kedalaman squat optimal (sudut lutut <= 95°).",
                type: "good",
                timestamp,
              });
              romScore = 100;
            } else if (this.lowestKneeAngle <= THRESHOLDS.SQUAT.BOTTOM_ACCEPTABLE_MAX) {
              feedbacks.push({
                id: "depth_good",
                message: "Kedalaman squat cukup baik.",
                type: "good",
                timestamp,
              });
              romScore = 85;
            } else {
              feedbacks.push({
                id: "depth_shallow",
                message: "Squat terlalu dangkal. Turunkan pinggul lebih rendah.",
                type: "warning",
                timestamp,
              });
              romScore = 60;
            }

            this.romRatings.push(romScore);
            const postureScore = Math.max(50, 100 - framePenalty);
            this.alignmentRatings.push(postureScore);

            this.formScorer.recordRepScore({
              rangeOfMotion: romScore,
              alignment: postureScore,
              posture: postureScore,
              tempo: this.tempoRatings[this.tempoRatings.length - 1] ?? 85,
              consistency: 90,
            });
          }

          // Reset cycle
          this.phase = "STANDING";
          this.lowestKneeAngle = 180;
        }
        break;
    }

    feedbacks.forEach((f) => this.accumulatedFeedbacks.add(f.message));
    this.formScorer.updateLiveScore(framePenalty);

    return this.buildFrame(kneeAngle, feedbacks, isRepCompleted, prepStatus);
  }

  private buildFrame(
    primaryAngle: number,
    feedbacks: FormFeedback[],
    isRepCompleted: boolean,
    prepStatus: PreparationStatus
  ): LiveAnalysisFrame {
    const score = this.formScorer.updateLiveScore();
    return {
      exercise: "squat",
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
    const avgTempo = this.tempoRatings.length
      ? this.tempoRatings.reduce((a, b) => a + b, 0) / this.tempoRatings.length
      : 85;

    let summaryAdvice = "Squat form sangat baik. Pertahankan postur dan tempo latihan ini.";
    if (avgRom < 75) {
      summaryAdvice = "Fokus pada kedalaman squat di repetisi berikutnya agar otot paha bekerja optimal.";
    } else if (avgTempo < 75) {
      summaryAdvice = "Kendalikan tempo fase turun (eccentric) agar tidak terburu-buru.";
    }

    return {
      exercise: "squat",
      setNumber: 1,
      targetReps: this.targetReps,
      completedReps: this.repCounter.getCount(),
      formScore: score,
      durationSeconds: Math.max(1, duration),
      status,
      feedbacks: Array.from(this.accumulatedFeedbacks),
      metrics: {
        rangeOfMotion: avgRom >= 85 ? "Good" : avgRom >= 70 ? "Fair" : "Needs Improvement",
        alignment: avgAlign >= 85 ? "Good" : "Fair",
        tempo: avgTempo >= 80 ? "Good" : "Too Fast",
      },
      summaryAdvice,
    };
  }
}
