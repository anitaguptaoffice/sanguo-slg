import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MINIMAP_VIEW, computeMinimapWorldBounds } from "@/ui/worldMinimap";
import {
  MINIMAP_FOCUS_PULSE_CLASS,
  MINIMAP_FOCUS_PULSE_MS,
  MINIMAP_MARCH_END_HIGHLIGHT_CLASS,
  applyMinimapFocusPulseClass,
  highlightMinimapMarchEnd,
  isMinimapFocusPulseActive,
  resetMinimapFocusPulseTimerForTests,
  syncMinimapFocusFromTileCard,
} from "@/ui/minimapTileFocusLink";

describe("minimapTileFocusLink (CLIENT-188)", () => {
  afterEach(() => {
    resetMinimapFocusPulseTimerForTests();
    vi.useRealTimers();
  });

  it("syncMinimapFocusFromTileCard frames focus grid and pulse window", () => {
    const bounds = computeMinimapWorldBounds(10, 10, [], null);
    const now = 1_000_000;
    const synced = syncMinimapFocusFromTileCard({ x: 42, y: 43 }, bounds, now);
    expect(synced.focusGrid).toEqual({ wx: 42, wy: 43 });
    expect(synced.focusPulseUntilMs).toBe(now + MINIMAP_FOCUS_PULSE_MS);
    expect(synced.view.zoom).toBeGreaterThanOrEqual(DEFAULT_MINIMAP_VIEW.zoom);
  });

  it("highlightMinimapMarchEnd returns dest grid for valid march", () => {
    expect(
      highlightMinimapMarchEnd({ march_id: 9, to_x: 5, to_y: 6, phase: 2 }),
    ).toEqual({ wx: 5, wy: 6, marchId: 9 });
    expect(highlightMinimapMarchEnd({ march_id: 1, to_x: null, to_y: 2 })).toBeNull();
    expect(highlightMinimapMarchEnd(null)).toBeNull();
  });

  it("isMinimapFocusPulseActive respects untilMs", () => {
    expect(isMinimapFocusPulseActive(1500, 1000)).toBe(true);
    expect(isMinimapFocusPulseActive(1000, 1000)).toBe(false);
  });

  it("applyMinimapFocusPulseClass toggles layout-frame class for 2s", () => {
    vi.useFakeTimers();
    const frame = document.createElement("div");
    applyMinimapFocusPulseClass(frame);
    expect(frame.classList.contains(MINIMAP_FOCUS_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(MINIMAP_FOCUS_PULSE_MS);
    expect(frame.classList.contains(MINIMAP_FOCUS_PULSE_CLASS)).toBe(false);
  });

  it("exports march-end highlight class constant for manifest", () => {
    expect(MINIMAP_MARCH_END_HIGHLIGHT_CLASS).toBe("minimap-march-end-highlight");
  });
});
