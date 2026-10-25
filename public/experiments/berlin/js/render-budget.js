// Adapt pixel work, not city geometry. Hysteresis prevents resolution flicker;
// isolated stalls and background-tab gaps don't count as sustained slow frames.
export class RenderBudget {
  constructor() { this.scale = 1; this.reset(); }
  reset() { this.seconds = 0; this.frames = 0; this.fastWindows = 0; }
  pixelRatio(width, height) {
    return Math.min(1, Math.sqrt(1920 * 1080 / Math.max(1, width * height))) * this.scale;
  }
  sample(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.25) { this.reset(); return false; }
    this.seconds += dt; this.frames++;
    if (this.seconds < 3) return false;
    const fps = this.frames / this.seconds;
    this.seconds = 0; this.frames = 0;
    const previous = this.scale;
    if (fps < 55) {
      this.scale = Math.max(0.7, Math.round((this.scale - 0.1) * 10) / 10);
      this.fastWindows = 0;
    } else if (fps > 59) {
      if (++this.fastWindows >= 4) {
        this.scale = Math.min(1, Math.round((this.scale + 0.1) * 10) / 10);
        this.fastWindows = 0;
      }
    } else this.fastWindows = 0;
    return this.scale !== previous;
  }
}
