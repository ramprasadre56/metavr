/** Tiny synthesized UI sounds (no audio assets needed). */
export class Sfx {
  private ctx: AudioContext | null = null;

  private ac(): AudioContext | null {
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private tone(freq: number, dur: number, delay = 0, gain = 0.08, type: OscillatorType = 'sine'): void {
    const ctx = this.ac();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  tick(): void { this.tone(880, 0.08, 0, 0.05, 'triangle'); }
  pick(): void { this.tone(520, 0.08, 0, 0.05); }
  drop(): void { this.tone(390, 0.1, 0, 0.05); }
  start(): void { this.tone(440, 0.18); this.tone(660, 0.25, 0.12); }
  success(): void { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, i * 0.09, 0.07)); }
}
