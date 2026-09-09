export type AnimationTone = "flash" | "burst" | "sweep" | "dragon";

export class AnimationSound {
  private context: AudioContext | null = null;
  private unlocked = false;
  private enabled = false;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isUnlocked(): boolean {
    return this.unlocked;
  }

  unlock(): void {
    if (this.unlocked) return;
    this.context = new AudioContext();
    void this.context.resume();
    this.unlocked = true;
  }

  play(tone: AnimationTone, volume: number): void {
    if (!this.enabled || !this.unlocked || !this.context) return;

    const ctx = this.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, volume));

    switch (tone) {
      case "flash":
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(clamped * 0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
        break;
      case "burst":
        osc.type = "triangle";
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.2);
        gain.gain.setValueAtTime(clamped * 0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
        break;
      case "sweep":
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(520, now + 0.35);
        gain.gain.setValueAtTime(clamped * 0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
        break;
      case "dragon":
        osc.type = "square";
        osc.frequency.setValueAtTime(110, now);
        osc.frequency.linearRampToValueAtTime(180, now + 0.5);
        gain.gain.setValueAtTime(clamped * 0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.start(now);
        osc.stop(now + 0.55);
        break;
    }
  }
}

export const animationSound = new AnimationSound();
