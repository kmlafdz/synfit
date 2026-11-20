import type { FormCategory, FormScoreBreakdown } from "./types.ts";
import { THRESHOLDS } from "./thresholds.ts";

export class FormScorer {
  private smoothedScore: number = 85;
  private repScores: number[] = [];
  private alpha: number = 0.25;

  constructor() {
    this.reset();
  }

  reset() {
    this.smoothedScore = 85;
    this.repScores = [];
  }

  /**
   * Update running live form score based on momentary frame deductions/bonuses
   */
  updateLiveScore(framePenalty: number = 0): number {
    const rawInstant = Math.max(30, Math.min(100, 100 - framePenalty));
    this.smoothedScore = this.alpha * rawInstant + (1 - this.alpha) * this.smoothedScore;
    return Math.round(this.smoothedScore);
  }

  /**
   * Record a completed rep's score calculation
   */
  recordRepScore(breakdown: FormScoreBreakdown): number {
    const score = Math.round(
      breakdown.rangeOfMotion * 0.35 +
      breakdown.alignment * 0.25 +
      breakdown.posture * 0.20 +
      breakdown.tempo * 0.15 +
      breakdown.consistency * 0.05
    );
    const clamped = Math.max(30, Math.min(100, score));
    this.repScores.push(clamped);
    this.smoothedScore = clamped;
    return clamped;
  }

  getOverallSetScore(): number {
    if (this.repScores.length === 0) {
      return Math.round(this.smoothedScore);
    }
    const sum = this.repScores.reduce((acc, v) => acc + v, 0);
    return Math.round(sum / this.repScores.length);
  }

  static getCategory(score: number): FormCategory {
    if (score >= THRESHOLDS.FORM_SCORE.EXCELLENT_MIN) return "Excellent";
    if (score >= THRESHOLDS.FORM_SCORE.GOOD_MIN) return "Good";
    if (score >= THRESHOLDS.FORM_SCORE.NEEDS_IMPROVEMENT_MIN) return "Needs Improvement";
    return "Poor";
  }
}
