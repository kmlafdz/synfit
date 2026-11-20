export class RepCounter {
  private count: number = 0;
  private lastRepTimestamp: number = 0;
  private minIntervalMs: number;

  constructor(minIntervalMs: number = 1000) {
    this.minIntervalMs = minIntervalMs;
  }

  reset() {
    this.count = 0;
    this.lastRepTimestamp = 0;
  }

  canIncrement(now: number): boolean {
    if (this.lastRepTimestamp === 0) return true;
    return now - this.lastRepTimestamp >= this.minIntervalMs;
  }

  increment(now: number): boolean {
    if (this.canIncrement(now)) {
      this.count += 1;
      this.lastRepTimestamp = now;
      return true;
    }
    return false;
  }

  getCount(): number {
    return this.count;
  }

  setCount(c: number) {
    this.count = c;
  }
}
