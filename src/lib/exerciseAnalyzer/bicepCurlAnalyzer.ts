import type {
  PoseLandmarks,
  BicepCurlPhase,
  FormFeedback,
  LiveAnalysisFrame,
  PreparationStatus,
  WorkoutSetResult,
} from "./types.ts";
import { THRESHOLDS } from "./thresholds.ts";
import { calculateAngle, AngleSmoother } from "./angleUtils.ts";
import { RepCounter } from "./repCounter.ts";
import { FormScorer } from "./formScorer.ts";

export class BicepCurlAnalyzer {
  private phase: BicepCurlPhase = "EXTENDED";
  private repCounter: RepCounter;
  private formScorer: FormScorer;
  private elbowSmoother = new AngleSmoother(0.4);

  private lowestElbowAngle: number = 180;
  private curlStartTime: number = 0;
  private targetReps: number = 12;
  private setStartTime: number = 0;

  private accumulatedFeedbacks: Set<string> = new Set();
  private romRatings: number[] = [];
  private stabilityRatings: number[] = [];
  private tempoRatings: number[] = [];

  constructor(targetReps: number = 12) {
    this.targetReps = targetReps;
    this.repCounter = new RepCounter(THRESHOLDS.BICEP_CURL.MIN_REP_TIME_MS);
    this.formScorer = new FormScorer();
  }

  reset() {
    this.phase = "EXTENDED";
    this.repCounter.reset();
    this.formScorer.reset();
    this.elbowSmoother.reset();
    this.lowestElbowAngle = 180;
    this.curlStartTime = 0;
    this.accumulatedFeedbacks.clear();
    this.setStartTime = performance.now();
    this.romRatings = [];
    this.stabilityRatings = [];
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
    // Left: shoulder=11, elbow=13, wrist=15
    // Right: shoulder=12, elbow=14, wrist=16
    const leftVis = (landmarks[11]?.visibility ?? 0) + (landmarks[13]?.visibility ?? 0) + (landmarks[15]?.visibility ?? 0);
    const rightVis = (landmarks[12]?.visibility ?? 0) + (landmarks[14]?.visibility ?? 0) + (landmarks[16]?.visibility ?? 0);

    const useLeft = leftVis >= rightVis;
    const shoulder = useLeft ? landmarks[11] : landmarks[12];
    const elbow = useLeft ? landmarks[13] : landmarks[14];
    const wrist = useLeft ? landmarks[15] : landmarks[16];

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
        message: "Landmark lengan/siku kurang jelas. Pastikan bahu, siku, dan pergelangan tangan berada di dalam frame kamera.",
        type: "info",
        timestamp,
      });
      return this.buildFrame(this.elbowSmoother.getValue() || 180, feedbacks, false, {
        ...prepStatus,
        guidanceMessage: "Kualitas landmark rendah. Pastikan lengan terlihat jelas.",
      });
    }

    const rawElbowAngle = calculateAngle(shoulder, elbow, wrist);
    const elbowAngle = this.elbowSmoother.smooth(rawElbowAngle);

    let framePenalty = 0;

    // Shoulder stability check: elbow should remain closely anchored under shoulder
    const horizontalDrift = Math.abs(elbow.x - shoulder.x);
    if (horizontalDrift > THRESHOLDS.BICEP_CURL.SHOULDER_DRIFT_MAX) {
      feedbacks.push({
        id: "elbow_flare",
        message: "Jaga siku tetap dekat dengan tubuh.",
        type: "warning",
        timestamp,
      });
      framePenalty += 20;
      this.stabilityRatings.push(65);
    } else {
      this.stabilityRatings.push(95);
    }

    // STATE MACHINE: EXTENDED -> CURLING -> CONTRACTED -> EXTENDED
    switch (this.phase) {
      case "EXTENDED":
        if (elbowAngle < THRESHOLDS.BICEP_CURL.EXTENDED_ELBOW_MIN - 10) {
          this.phase = "CURLING";
          this.curlStartTime = timestamp;
          this.lowestElbowAngle = elbowAngle;
        }
        break;

      case "CURLING":
        if (elbowAngle < this.lowestElbowAngle) {
          this.lowestElbowAngle = elbowAngle;
        }

        // Reached contracted peak
        if (elbowAngle <= THRESHOLDS.BICEP_CURL.CONTRACTED_ACCEPTABLE_MAX) {
          this.phase = "CONTRACTED";

          // Tempo check on contraction
          const curlDuration = timestamp - this.curlStartTime;
          if (curlDuration < 400) {
            feedbacks.push({
              id: "tempo_fast",
              message: "Gerakan terlalu cepat. Kontrol kontraksi.",
              type: "warning",
              timestamp,
            });
            framePenalty += 15;
            this.tempoRatings.push(65);
          } else {
            this.tempoRatings.push(95);
          }
        } else if (elbowAngle > THRESHOLDS.BICEP_CURL.EXTENDED_ELBOW_MIN - 5) {
          // Aborted curl
          this.phase = "EXTENDED";
        }
        break;

      case "CONTRACTED":
        if (elbowAngle < this.lowestElbowAngle) {
          this.lowestElbowAngle = elbowAngle;
        }

        // Return to extended position
        if (elbowAngle >= THRESHOLDS.BICEP_CURL.EXTENDED_ELBOW_MIN) {
          const repAccepted = this.repCounter.increment(timestamp);
          if (repAccepted) {
            isRepCompleted = true;

            let romScore = 90;
            if (this.lowestElbowAngle <= THRESHOLDS.BICEP_CURL.CONTRACTED_ELBOW_MAX) {
              feedbacks.push({
                id: "curl_perfect",
                message: "Kontraksi fleksi siku optimal (sudut siku <= 55°).",
                type: "good",
                timestamp,
              });
              romScore = 100;
            } else if (this.lowestElbowAngle <= THRESHOLDS.BICEP_CURL.CONTRACTED_ACCEPTABLE_MAX) {
              feedbacks.push({
                id: "curl_good",
                message: "Kontraksi siku cukup baik.",
                type: "good",
                timestamp,
              });
              romScore = 80;
            } else {
              feedbacks.push({
                id: "rom_short",
                message: "Rentangkan lengan lebih penuh pada akhir gerakan.",
                type: "warning",
                timestamp,
              });
              romScore = 60;
            }

            this.romRatings.push(romScore);

            this.formScorer.recordRepScore({
              rangeOfMotion: romScore,
              alignment: Math.max(50, 100 - framePenalty),
              posture: 90,
              tempo: this.tempoRatings[this.tempoRatings.length - 1] ?? 85,
              consistency: 90,
            });
          }

          this.phase = "EXTENDED";
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
      exercise: "bicep_curl",
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
    const avgStability = this.stabilityRatings.length
      ? this.stabilityRatings.reduce((a, b) => a + b, 0) / this.stabilityRatings.length
      : 85;

    let summaryAdvice = "Gerakan curl terkontrol dengan baik. Pertahankan siku tetap stabil.";
    if (avgRom < 75) {
      summaryAdvice = "Fokus pada rentang gerak penuh: rentangkan lengan ke bawah dan kunci kontraksi di atas.";
    }

    return {
      exercise: "bicep_curl",
      setNumber: 1,
      targetReps: this.targetReps,
      completedReps: this.repCounter.getCount(),
      formScore: score,
      durationSeconds: Math.max(1, duration),
      status,
      feedbacks: Array.from(this.accumulatedFeedbacks),
      metrics: {
        rangeOfMotion: avgRom >= 85 ? "Good" : "Needs Improvement",
        alignment: avgStability >= 85 ? "Good" : "Fair",
        tempo: "Good",
      },
      summaryAdvice,
    };
  }
}
