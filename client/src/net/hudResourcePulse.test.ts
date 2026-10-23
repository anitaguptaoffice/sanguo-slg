import { describe, expect, it, vi, afterEach } from "vitest";
import {
  RESOURCE_PULSE_CLASS,
  RESOURCE_PULSE_MS,
  scheduleHudResourcePulse,
  walletResourcePulseKeys,
} from "@/net/hudResourcePulse";
import { appendHudResourceStrip } from "@/engine/artResourceHud";
import type { AssetLoader } from "@/engine/AssetLoader";

describe("walletResourcePulseKeys", () => {
  it("returns keys with strictly positive deltas only", () => {
    expect(walletResourcePulseKeys(undefined, { food: 10 })).toEqual(["food"]);
    expect(walletResourcePulseKeys({ food: 100, wood: 50 }, { food: 250, wood: 10, gold: 5 })).toEqual([
      "food",
      "gold",
    ]);
    expect(walletResourcePulseKeys({ food: 100 }, { food: 100 })).toEqual([]);
    expect(walletResourcePulseKeys({ food: 200 }, { food: 100 })).toEqual([]);
  });
});

describe("scheduleHudResourcePulse", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies resource-pulse class to matching strip items", () => {
    const hud = document.createElement("div");
    const assets = { getImageForAsset: vi.fn(() => undefined) } as unknown as AssetLoader;
    appendHudResourceStrip(hud, { food: 1, wood: 2 }, assets);
    scheduleHudResourcePulse(hud, ["food", "wood"]);
    const food = hud.querySelector('[data-resource="food"]');
    const wood = hud.querySelector('[data-resource="wood"]');
    expect(food?.classList.contains(RESOURCE_PULSE_CLASS)).toBe(true);
    expect(wood?.classList.contains(RESOURCE_PULSE_CLASS)).toBe(true);
    expect(hud.querySelector('[data-resource="iron"]')?.classList.contains(RESOURCE_PULSE_CLASS)).toBe(false);
  });

  it("removes pulse class after RESOURCE_PULSE_MS", () => {
    vi.useFakeTimers();
    const hud = document.createElement("div");
    const assets = { getImageForAsset: vi.fn(() => undefined) } as unknown as AssetLoader;
    appendHudResourceStrip(hud, { gold: 9 }, assets);
    scheduleHudResourcePulse(hud, ["gold"]);
    const gold = hud.querySelector('[data-resource="gold"]');
    expect(gold?.classList.contains(RESOURCE_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(RESOURCE_PULSE_MS);
    expect(gold?.classList.contains(RESOURCE_PULSE_CLASS)).toBe(false);
  });
});
