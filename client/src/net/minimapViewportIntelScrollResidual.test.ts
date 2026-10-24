import { afterEach, describe, expect, it, vi } from "vitest";
import { MINIMAP_INTEL_SYNC_RING_CLASS } from "@/ui/minimapIntelSyncHighlight";
import { MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS } from "@/net/minimapViewportIntelSync";
import {
  beginMinimapIntelScrollSyncDeepRing,
  createMinimapViewportIntelScrollResidualTimers,
  MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS,
  MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_MS,
  resetMinimapViewportIntelScrollResidualTimersForTests,
  syncMinimapViewportIntelScrollResidual,
} from "@/net/minimapViewportIntelScrollResidual";
import { DEFAULT_MINIMAP_VIEW } from "@/ui/worldMinimap";

describe("minimapViewportIntelScrollResidual (CLIENT-252)", () => {
  afterEach(() => {
    resetMinimapViewportIntelScrollResidualTimersForTests(
      createMinimapViewportIntelScrollResidualTimers(),
    );
  });

  it("syncMinimapViewportIntelScrollResidual keeps CLIENT-236 ring and adds deep ring + list scroll", () => {
    const frame = document.createElement("div");
    frame.classList.add(MINIMAP_INTEL_SYNC_RING_CLASS);
    const intelRoot = document.createElement("div");
    intelRoot.innerHTML = `
      <div class="panel-scroll-body" data-role="march-scroll" style="height:40px;overflow:auto">
        <ul class="march-list">
          <li data-march-id="7" style="height:24px">m7</li>
        </ul>
      </div>
    `;
    const scroll = intelRoot.querySelector(".panel-scroll-body") as HTMLElement;
    const li = intelRoot.querySelector("li") as HTMLElement;
    Object.defineProperty(li, "offsetTop", { value: 80, configurable: true });
    Object.defineProperty(li, "offsetHeight", { value: 24, configurable: true });
    Object.defineProperty(scroll, "clientHeight", { value: 40, configurable: true });
    scroll.scrollTop = 0;

    const residualTimers = createMinimapViewportIntelScrollResidualTimers();
    const fake = vi.useFakeTimers();
    const bounds = { minX: 0, minY: 0, maxX: 499, maxY: 499 };
    const result = syncMinimapViewportIntelScrollResidual(
      {
        march: { march_id: 7, to_x: 120, to_y: 130 },
        bounds,
        currentView: DEFAULT_MINIMAP_VIEW,
        layoutFrame: frame,
        intelRoot,
      },
      { residualTimers },
    );
    expect(result.applied).toBe(true);
    expect(frame.classList.contains(MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS)).toBe(true);
    expect(frame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS)).toBe(true);
    expect(frame.classList.contains(MINIMAP_INTEL_SYNC_RING_CLASS)).toBe(true);
    expect(li.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS)).toBe(true);
    expect(scroll.scrollTop).toBeGreaterThan(0);

    fake.advanceTimersByTime(MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_MS);
    expect(frame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS)).toBe(false);
    expect(li.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS)).toBe(false);
    fake.useRealTimers();
  });

  it("beginMinimapIntelScrollSyncDeepRing clears prior timer", () => {
    const frame = document.createElement("div");
    const timers = createMinimapViewportIntelScrollResidualTimers();
    const fake = vi.useFakeTimers();
    beginMinimapIntelScrollSyncDeepRing(frame, null, { timers });
    expect(frame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS)).toBe(true);
    beginMinimapIntelScrollSyncDeepRing(frame, null, { timers });
    fake.advanceTimersByTime(MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_MS);
    expect(frame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS)).toBe(false);
    fake.useRealTimers();
  });
});
