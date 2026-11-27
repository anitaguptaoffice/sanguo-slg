const STORAGE_KEY = "sanguo-sfx-muted-v1";

export type SoundCue =
  | "ui-click"
  | "ui-panel"
  | "build-upgrade"
  | "recruit"
  | "march"
  | "victory"
  | "defeat";

let shared: SoundEngine | null = null;

export function getSoundEngine(): SoundEngine {
  if (!shared) shared = new SoundEngine();
  return shared;
}

export function isSoundMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (shared) shared.setMuted(muted);
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = isSoundMuted();

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(STORAGE_KEY, muted ? "1" : "0");
    } catch {
      /* ignore */
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggleMuted(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private ensureCtx(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (this.muted) return null;
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return null;
        this.ctx = new Ctx();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  play(cue: SoundCue): void {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const profile = CUE_PROFILE[cue];
    osc.type = profile.type;
    osc.frequency.setValueAtTime(profile.freq, now);
    if (profile.slide) {
      osc.frequency.exponentialRampToValueAtTime(profile.slide, now + profile.duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(profile.gain, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + profile.duration);
    osc.start(now);
    osc.stop(now + profile.duration + 0.02);
  }
}

const CUE_PROFILE: Record<
  SoundCue,
  { type: OscillatorType; freq: number; slide?: number; duration: number; gain: number }
> = {
  "ui-click": { type: "triangle", freq: 520, duration: 0.06, gain: 0.08 },
  "ui-panel": { type: "sine", freq: 320, slide: 280, duration: 0.12, gain: 0.07 },
  "build-upgrade": { type: "sine", freq: 440, slide: 660, duration: 0.22, gain: 0.1 },
  recruit: { type: "square", freq: 280, slide: 360, duration: 0.18, gain: 0.06 },
  march: { type: "triangle", freq: 220, slide: 180, duration: 0.25, gain: 0.09 },
  victory: { type: "sine", freq: 523, slide: 784, duration: 0.35, gain: 0.11 },
  defeat: { type: "sawtooth", freq: 180, slide: 120, duration: 0.3, gain: 0.07 },
};