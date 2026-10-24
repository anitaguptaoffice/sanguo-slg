import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WORLD_TILE_FOCUS_PULSE_CLASS,
  applyWorldTileFocusPulse,
  resetWorldTileFocusPulseTimerForTests,
  shouldPulseWorldTileFocusOnSelect,
  worldTileGridMatchesMinimapPick,
} from "@/ui/worldTileSelectionSync";

describe("worldTileSelectionSync (CLIENT-170)", () => {
  afterEach(() => {
    resetWorldTileFocusPulseTimerForTests();
    vi.useRealTimers();
  });

  it("shouldPulseWorldTileFocusOnSelect only for minimap source", () => {
    expect(shouldPulseWorldTileFocusOnSelect("minimap")).toBe(true);
    expect(shouldPulseWorldTileFocusOnSelect("world_list")).toBe(false);
    expect(shouldPulseWorldTileFocusOnSelect("external")).toBe(false);
    expect(shouldPulseWorldTileFocusOnSelect(undefined)).toBe(false);
  });

  it("worldTileGridMatchesMinimapPick aligns minimap pick with world selection", () => {
    expect(worldTileGridMatchesMinimapPick({ x: 8, y: 9 }, { wx: 8, wy: 9 })).toBe(true);
    expect(worldTileGridMatchesMinimapPick({ x: 8, y: 9 }, { wx: 1, wy: 9 })).toBe(false);
    expect(worldTileGridMatchesMinimapPick(null, { wx: 1, wy: 2 })).toBe(false);
  });

  it("applyWorldTileFocusPulse toggles class for 2s", () => {
    vi.useFakeTimers();
    const card = document.createElement("aside");
    applyWorldTileFocusPulse(card);
    expect(card.classList.contains(WORLD_TILE_FOCUS_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(card.classList.contains(WORLD_TILE_FOCUS_PULSE_CLASS)).toBe(false);
  });
});
