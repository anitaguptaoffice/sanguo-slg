import { afterEach, describe, expect, it, vi } from "vitest";
import {
  beginMinimapIntelSyncRing,
  beginMinimapIntelSyncRingForMarch,
  createMinimapIntelSyncTimers,
  highlightIntelRowForMinimapTile,
  INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_CLASS,
  isMinimapIntelSyncRingActive,
  MINIMAP_INTEL_SYNC_RING_CLASS,
  MINIMAP_INTEL_SYNC_RING_MS,
  resetMinimapIntelSyncTimersForTests,
  resolveMarchIdForMinimapIntelTile,
} from "@/ui/minimapIntelSyncHighlight";

describe("minimapIntelSyncHighlight (CLIENT-220)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolveMarchIdForMinimapIntelTile uses first march at dest cell", () => {
    const marches = [
      { march_id: 2, to_x: 5, to_y: 5, phase: 2 },
      { march_id: 7, to_x: 5, to_y: 5, phase: 2 },
    ];
    expect(resolveMarchIdForMinimapIntelTile(marches, 5, 5)).toBe(2);
    expect(resolveMarchIdForMinimapIntelTile(marches, 9, 9)).toBeNull();
  });

  it("highlightIntelRowForMinimapTile applies intel-row-minimap-sync-highlight", () => {
    vi.useFakeTimers();
    const timers = createMinimapIntelSyncTimers();
    const root = document.createElement("div");
    root.innerHTML = `
      <ul class="march-list">
        <li data-march-id="3"><span>row</span></li>
      </ul>
    `;
    const marches = [{ march_id: 3, to_x: 1, to_y: 2, phase: 2 }];

    const id = highlightIntelRowForMinimapTile(root, marches, 1, 2, { timers });
    expect(id).toBe(3);
    const row = root.querySelector("li")!;
    expect(row.classList.contains(INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_CLASS)).toBe(true);

    vi.advanceTimersByTime(MINIMAP_INTEL_SYNC_RING_MS);
    expect(row.classList.contains(INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_CLASS)).toBe(false);
    resetMinimapIntelSyncTimersForTests(timers);
  });

  it("beginMinimapIntelSyncRing toggles minimap-intel-sync-ring on layout-frame", () => {
    vi.useFakeTimers();
    const timers = createMinimapIntelSyncTimers();
    const frame = document.createElement("div");
    frame.id = "layout-frame";

    const state = beginMinimapIntelSyncRing(4, 6, frame, {
      timers,
      nowMs: 1000,
      durationMs: 1500,
    });
    expect(state).toEqual({ wx: 4, wy: 6, untilMs: 2500 });
    expect(frame.classList.contains(MINIMAP_INTEL_SYNC_RING_CLASS)).toBe(true);
    expect(isMinimapIntelSyncRingActive(state!.untilMs, 2000)).toBe(true);
    expect(isMinimapIntelSyncRingActive(state!.untilMs, 2600)).toBe(false);

    vi.advanceTimersByTime(1500);
    expect(frame.classList.contains(MINIMAP_INTEL_SYNC_RING_CLASS)).toBe(false);
    resetMinimapIntelSyncTimersForTests(timers);
  });

  it("beginMinimapIntelSyncRingForMarch skips invalid coords", () => {
    expect(beginMinimapIntelSyncRingForMarch(null, null)).toBeNull();
    expect(
      beginMinimapIntelSyncRingForMarch({ to_x: null, to_y: 1 }, null),
    ).toBeNull();
  });
});
