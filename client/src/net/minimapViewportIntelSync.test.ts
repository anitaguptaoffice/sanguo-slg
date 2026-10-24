import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MINIMAP_VIEWPORT_INTEL_ANCHOR_SESSION_KEY,
  MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS,
  MINIMAP_VIEWPORT_INTEL_SYNC_RING_MS,
  beginMinimapViewportIntelSyncRing,
  createMinimapViewportIntelSyncTimers,
  parseMinimapViewportIntelAnchor,
  resetMinimapViewportIntelSyncTimersForTests,
  resolveMarchIdAtMinimapViewportCenter,
  scrollIntelListToVisibleMarch,
  scrollIntelRowIntoMarchPanelBody,
  serializeMinimapViewportIntelAnchor,
  syncMinimapViewportToIntelRow,
  writeMinimapViewportIntelAnchor,
} from "@/net/minimapViewportIntelSync";
import { DEFAULT_MINIMAP_VIEW, MINIMAP_LAYOUT_RECT } from "@/ui/worldMinimap";

describe("minimapViewportIntelSync (CLIENT-236)", () => {
  afterEach(() => {
    sessionStorage.clear();
    resetMinimapViewportIntelSyncTimersForTests(createMinimapViewportIntelSyncTimers());
  });

  it("serializeMinimapViewportIntelAnchor round-trips march + view pan/zoom", () => {
    const raw = serializeMinimapViewportIntelAnchor({
      marchId: 9,
      toX: 40,
      toY: 41,
      zoom: 1.5,
      panWx: 2.25,
      panWy: -1,
    });
    expect(parseMinimapViewportIntelAnchor(raw)).toEqual({
      marchId: 9,
      toX: 40,
      toY: 41,
      zoom: 1.5,
      panWx: 2.25,
      panWy: -1,
    });
    writeMinimapViewportIntelAnchor({
      marchId: 3,
      toX: 1,
      toY: 2,
      zoom: 2,
      panWx: 0,
      panWy: 0,
    });
    expect(sessionStorage.getItem(MINIMAP_VIEWPORT_INTEL_ANCHOR_SESSION_KEY)).toBe(
      serializeMinimapViewportIntelAnchor({
        marchId: 3,
        toX: 1,
        toY: 2,
        zoom: 2,
        panWx: 0,
        panWy: 0,
      }),
    );
  });

  it("syncMinimapViewportToIntelRow frames viewport and applies viewport sync ring", () => {
    const frame = document.createElement("div");
    const timers = createMinimapViewportIntelSyncTimers();
    const fake = vi.useFakeTimers();
    const bounds = { minX: 0, minY: 0, maxX: 499, maxY: 499 };
    const result = syncMinimapViewportToIntelRow(
      {
        march: { march_id: 7, to_x: 120, to_y: 130 },
        bounds,
        currentView: DEFAULT_MINIMAP_VIEW,
        layoutFrame: frame,
      },
      { timers },
    );
    expect(result.applied).toBe(true);
    expect(result.view.zoom).toBeGreaterThanOrEqual(1);
    expect(frame.classList.contains(MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS)).toBe(true);
    fake.advanceTimersByTime(MINIMAP_VIEWPORT_INTEL_SYNC_RING_MS - 1);
    expect(frame.classList.contains(MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS)).toBe(true);
    fake.advanceTimersByTime(1);
    expect(frame.classList.contains(MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS)).toBe(false);
    fake.useRealTimers();
  });

  it("scrollIntelRowIntoMarchPanelBody scrolls within panel-scroll-body", () => {
    const panel = document.createElement("div");
    panel.innerHTML = `
      <div class="panel-scroll-body" data-role="march-scroll" style="height:60px;overflow:auto">
        <ul class="march-list">
          <li data-march-id="1" style="height:30px">a</li>
          <li data-march-id="2" style="height:30px">b</li>
          <li data-march-id="3" style="height:30px">c</li>
          <li data-march-id="4" style="height:30px">d</li>
          <li data-march-id="5" style="height:30px">e</li>
        </ul>
      </div>
    `;
    document.body.appendChild(panel);
    const scroll = panel.querySelector(".panel-scroll-body") as HTMLElement;
    const ul = panel.querySelector("ul") as HTMLElement;
    Object.defineProperty(ul, "offsetTop", { value: 0, configurable: true });
    Object.defineProperty(scroll, "clientHeight", { value: 60, configurable: true });
    panel.querySelectorAll("li").forEach((li, index) => {
      Object.defineProperty(li, "offsetTop", { value: index * 30, configurable: true });
      Object.defineProperty(li, "offsetHeight", { value: 30, configurable: true });
    });
    scroll.scrollTop = 0;
    expect(scrollIntelRowIntoMarchPanelBody(panel, 5)).toBe(true);
    expect(scroll.scrollTop).toBeGreaterThan(0);
    panel.remove();
  });

  it("scrollIntelListToVisibleMarch uses viewport center march", () => {
    const panel = document.createElement("div");
    panel.innerHTML = `
      <div class="panel-scroll-body" data-role="march-scroll" style="height:40px;overflow:auto">
        <ul class="march-list">
          <li data-march-id="10" style="height:24px">m10</li>
          <li data-march-id="11" style="height:24px">m11</li>
        </ul>
      </div>
    `;
    const marches = [
      { march_id: 10, to_x: 50, to_y: 50, phase: 2 },
      { march_id: 11, to_x: 200, to_y: 200, phase: 2 },
    ];
    const bounds = { minX: 0, minY: 0, maxX: 499, maxY: 499 };
    const cx = MINIMAP_LAYOUT_RECT.x + MINIMAP_LAYOUT_RECT.w / 2;
    const cy = MINIMAP_LAYOUT_RECT.y + MINIMAP_LAYOUT_RECT.h / 2;
    const centerId = resolveMarchIdAtMinimapViewportCenter(
      marches,
      10,
      10,
      bounds,
      MINIMAP_LAYOUT_RECT,
      DEFAULT_MINIMAP_VIEW,
    );
    expect(centerId).toBeDefined();
    const id = scrollIntelListToVisibleMarch({
      intelRoot: panel,
      marches,
      ownCityX: 10,
      ownCityY: 10,
      bounds,
      rect: MINIMAP_LAYOUT_RECT,
      view: DEFAULT_MINIMAP_VIEW,
      preferredMarchId: centerId,
    });
    expect(id).toBe(centerId);
  });

  it("beginMinimapViewportIntelSyncRing is independent of CLIENT-220 ring class", () => {
    const frame = document.createElement("div");
    frame.classList.add("minimap-intel-sync-ring");
    beginMinimapViewportIntelSyncRing(frame);
    expect(frame.classList.contains("minimap-intel-sync-ring")).toBe(true);
    expect(frame.classList.contains(MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS)).toBe(true);
  });
});
