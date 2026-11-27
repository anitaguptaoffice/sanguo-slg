import { describe, expect, it, vi } from "vitest";
import { getSoundEngine, isSoundMuted, setSoundMuted } from "@/audio/soundEngine";

describe("soundEngine", () => {
  it("persists mute flag", () => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
    });
    setSoundMuted(true);
    expect(isSoundMuted()).toBe(true);
    const engine = getSoundEngine();
    expect(engine.isMuted()).toBe(true);
    engine.toggleMuted();
    expect(engine.isMuted()).toBe(false);
    vi.unstubAllGlobals();
  });

  it("play is no-op when muted", () => {
    const engine = getSoundEngine();
    engine.setMuted(true);
    expect(() => engine.play("ui-click")).not.toThrow();
  });
});