import type { NormalizedLandmark } from "./types.ts";

/**
 * Calculates the internal angle at vertex B formed by points A-B-C in degrees [0, 180].
 */
export function calculateAngle(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark
): number {
  const radians =
    Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);
  if (angle > 180.0) {
    angle = 360.0 - angle;
  }
  return angle;
}

/**
 * Calculates angle of torso vector relative to vertical (y-axis).
 * Returns angle in degrees [0, 90].
 */
export function calculateTorsoAngle(
  shoulder: NormalizedLandmark,
  hip: NormalizedLandmark
): number {
  const dx = Math.abs(shoulder.x - hip.x);
  const dy = Math.abs(shoulder.y - hip.y);
  if (dy === 0) return 90;
  const radians = Math.atan2(dx, dy);
  return (radians * 180.0) / Math.PI;
}

/**
 * Exponential Moving Average (EMA) smoother for real-time sensor / landmark angles.
 */
export class AngleSmoother {
  private current: number | null = null;
  private alpha: number;

  constructor(alpha: number = 0.35) {
    this.alpha = alpha;
  }

  smooth(newValue: number): number {
    if (this.current === null || isNaN(this.current)) {
      this.current = newValue;
    } else {
      this.current = this.alpha * newValue + (1 - this.alpha) * this.current;
    }
    return Math.round(this.current * 10) / 10;
  }

  reset() {
    this.current = null;
  }

  getValue(): number {
    return this.current ?? 0;
  }
}
