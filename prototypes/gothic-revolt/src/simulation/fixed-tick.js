export class FixedTicker {
  constructor(rate = 60, maxSteps = 8) {
    this.rate = rate;
    this.stepSeconds = 1 / rate;
    this.maxSteps = maxSteps;
    this.accumulator = 0;
    this.tick = 0;
  }

  reset() {
    this.accumulator = 0;
    this.tick = 0;
  }

  consume(frameSeconds, update) {
    this.accumulator += Math.min(Math.max(frameSeconds, 0), 0.25);
    let steps = 0;
    while (this.accumulator >= this.stepSeconds && steps < this.maxSteps) {
      update(this.stepSeconds, this.tick);
      this.accumulator -= this.stepSeconds;
      this.tick += 1;
      steps += 1;
    }
    if (steps === this.maxSteps) this.accumulator = Math.min(this.accumulator, this.stepSeconds);
    return this.accumulator / this.stepSeconds;
  }

  advanceTicks(count, update) {
    for (let index = 0; index < count; index += 1) {
      update(this.stepSeconds, this.tick);
      this.tick += 1;
    }
  }
}
