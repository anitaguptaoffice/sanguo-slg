import { afterEach, describe, expect, it, vi } from "vitest";
import { MINIMAP_INTEL_SYNC_RING_CLASS } from "@/ui/minimapIntelSyncHighlight";
import {
  MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS,
  MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_MS,
  createMinimapViewportIntelScrollResidualTimers,
} from "@/net/minimapViewportIntelScrollResidual";
import {
  createMinimapViewportIntelScrollResidualDeepTimers,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_CLASS,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_MS,
} from "@/net/minimapViewportIntelScrollResidualDeep";
import {
  createMinimapViewportIntelScrollResidualDeeperTimers,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPER_RING_CLASS,
} from "@/net/minimapViewportIntelScrollResidualDeeper";
import {
  createMinimapViewportIntelScrollResidualDeepestTimers,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_RING_CLASS,
} from "@/net/minimapViewportIntelScrollResidualDeepest";
import {
  createMinimapViewportIntelScrollResidualDeepestDeeperTimers,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_CLASS,
} from "@/net/minimapViewportIntelScrollResidualDeepestDeeper";
import {
  createMinimapViewportIntelScrollResidualDeepestDeepestDeeperTimers,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
} from "@/net/minimapViewportIntelScrollResidualDeepestDeepestDeeper";
import {
  createMinimapViewportIntelScrollResidualDeepestDeepestDeepestTimers,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS,
} from "@/net/minimapViewportIntelScrollResidualDeepestDeepestDeepest";
import {
  beginMinimapIntelScrollSyncResidualDeepestDeepestDeepestDeeperRing,
  createMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeperTimers,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS,
  resetMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeperTimersForTests,
  syncMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeper,
} from "@/net/minimapViewportIntelScrollResidualDeepestDeepestDeepestDeeper";
import { DEFAULT_MINIMAP_VIEW } from "@/ui/worldMinimap";

describe("syncMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeper (CLIENT-364)", () => {
  afterEach(() => {
    resetMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeperTimersForTests(
      createMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeperTimers(),
    );
  });

  it("keeps CLIENT-348 residual deepest-deepest-deepest ring and adds residual deepest-deepest-deepest-deeper ring 1.5s", () => {
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
    const residualDeepTimers = createMinimapViewportIntelScrollResidualDeepTimers();
    const residualDeeperTimers = createMinimapViewportIntelScrollResidualDeeperTimers();
    const residualDeepestTimers = createMinimapViewportIntelScrollResidualDeepestTimers();
    const residualDeepestDeeperTimers = createMinimapViewportIntelScrollResidualDeepestDeeperTimers();
    const residualDeepestDeepestDeeperTimers =
      createMinimapViewportIntelScrollResidualDeepestDeepestDeeperTimers();
    const residualDeepestDeepestDeepestTimers =
      createMinimapViewportIntelScrollResidualDeepestDeepestDeepestTimers();
    const residualDeepestDeepestDeepestDeeperTimers =
      createMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeperTimers();
    const fake = vi.useFakeTimers();
    const bounds = { minX: 0, minY: 0, maxX: 499, maxY: 499 };
    const result = syncMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeper(
      {
        march: { march_id: 7, to_x: 120, to_y: 130 },
        bounds,
        currentView: DEFAULT_MINIMAP_VIEW,
        layoutFrame: frame,
        intelRoot,
      },
      {
        residualTimers,
        residualDeepTimers,
        residualDeeperTimers,
        residualDeepestTimers,
        residualDeepestDeeperTimers,
        residualDeepestDeepestDeeperTimers,
        residualDeepestDeepestDeepestTimers,
        residualDeepestDeepestDeepestDeeperTimers,
      },
    );
    expect(result.applied).toBe(true);
    expect(frame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS)).toBe(true);
    expect(frame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_CLASS)).toBe(
      true,
    );
    expect(frame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPER_RING_CLASS)).toBe(
      true,
    );
    expect(frame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_RING_CLASS)).toBe(
      true,
    );
    expect(
      frame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_CLASS),
    ).toBe(true);
    expect(
      frame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS),
    ).toBe(true);
    expect(
      frame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS),
    ).toBe(true);
    expect(
      frame.classList.contains(
        MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
      ),
    ).toBe(true);
    expect(frame.classList.contains(MINIMAP_INTEL_SYNC_RING_CLASS)).toBe(true);
    expect(
      li.classList.contains(
        MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
      ),
    ).toBe(true);

    fake.advanceTimersByTime(MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_MS);
    expect(frame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS)).toBe(false);
    expect(
      frame.classList.contains(
        MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
      ),
    ).toBe(true);

    fake.advanceTimersByTime(
      MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_MS - MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_MS,
    );
    expect(frame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_CLASS)).toBe(
      false,
    );
    expect(frame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPER_RING_CLASS)).toBe(
      false,
    );
    expect(frame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_RING_CLASS)).toBe(
      false,
    );
    expect(
      frame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_CLASS),
    ).toBe(false);
    expect(
      frame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS),
    ).toBe(false);
    expect(
      frame.classList.contains(MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS),
    ).toBe(false);
    expect(
      frame.classList.contains(
        MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
      ),
    ).toBe(false);
    expect(
      li.classList.contains(
        MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
      ),
    ).toBe(false);
    fake.useRealTimers();
  });

  it("beginMinimapIntelScrollSyncResidualDeepestDeepestDeepestDeeperRing clears prior timer", () => {
    const frame = document.createElement("div");
    const timers = createMinimapViewportIntelScrollResidualDeepestDeepestDeepestDeeperTimers();
    const fake = vi.useFakeTimers();
    beginMinimapIntelScrollSyncResidualDeepestDeepestDeepestDeeperRing(frame, null, { timers });
    expect(
      frame.classList.contains(
        MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
      ),
    ).toBe(true);
    beginMinimapIntelScrollSyncResidualDeepestDeepestDeepestDeeperRing(frame, null, { timers });
    fake.advanceTimersByTime(
      MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS,
    );
    expect(
      frame.classList.contains(
        MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
      ),
    ).toBe(false);
    fake.useRealTimers();
  });
});
