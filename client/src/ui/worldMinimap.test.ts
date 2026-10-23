import { describe, expect, it } from "vitest";
import type { MarchSummary } from "@/net/militaryFormat";
import {
  MINIMAP_COLLAPSED_SESSION_KEY,
  MINIMAP_LAYOUT_RECT,
  applyMinimapPan,
  clampWorldMapCoord,
  collectMinimapDestMarkers,
  computeMinimapScaleBar,
  computeMinimapWorldBounds,
  findFirstMarchByDest,
  findMarchIdForMinimapDestClick,
  layoutPointInMinimap,
  minimapLayoutToWorld,
  WORLD_MAP_EDGE,
  layoutPointInMinimapMap,
  layoutPointInMinimapToggle,
  marchSelectionMatchesListRow,
  marchShowsDestOnMinimap,
  minimapMarchRouteStroke,
  readMinimapCollapsedFromSession,
  writeMinimapCollapsedToSession,
  worldToMinimapLayout,
  DEFAULT_MINIMAP_VIEW,
} from "@/ui/worldMinimap";

describe("worldMinimap", () => {
  const marches: MarchSummary[] = [
    { march_id: 1, phase: 2, to_x: 10, to_y: 20, from_x: 5, from_y: 5 },
    { march_id: 2, phase: 2, to_x: 10, to_y: 20, from_x: 6, from_y: 6 },
    { march_id: 3, phase: 5, to_x: 99, to_y: 99 },
  ];

  it("filters dest markers by active phases", () => {
    expect(marchShowsDestOnMinimap({ phase: 2 })).toBe(true);
    expect(marchShowsDestOnMinimap({ phase: 5 })).toBe(false);
    const markers = collectMinimapDestMarkers(marches);
    expect(markers).toHaveLength(2);
    expect(markers.every((m) => m.wx === 10 && m.wy === 20)).toBe(true);
  });

  it("maps world coords into minimap rect", () => {
    const bounds = computeMinimapWorldBounds(5, 5, marches, null);
    const p = worldToMinimapLayout(10, 20, bounds, MINIMAP_LAYOUT_RECT, DEFAULT_MINIMAP_VIEW);
    expect(layoutPointInMinimap(p.x, p.y)).toBe(true);
    expect(p.x).toBeGreaterThan(MINIMAP_LAYOUT_RECT.x);
    expect(p.y).toBeGreaterThan(MINIMAP_LAYOUT_RECT.y);
  });

  it("round-trips world ↔ layout and clamps to map edge", () => {
    const bounds = computeMinimapWorldBounds(5, 5, marches, null);
    const p = worldToMinimapLayout(10, 20, bounds, MINIMAP_LAYOUT_RECT, DEFAULT_MINIMAP_VIEW);
    const back = minimapLayoutToWorld(p.x, p.y, bounds, MINIMAP_LAYOUT_RECT, DEFAULT_MINIMAP_VIEW);
    expect(back).toEqual({ wx: 10, wy: 20 });
    expect(clampWorldMapCoord(-3)).toBe(0);
    expect(clampWorldMapCoord(999)).toBe(WORLD_MAP_EDGE - 1);
    expect(minimapLayoutToWorld(0, 0, bounds, MINIMAP_LAYOUT_RECT, DEFAULT_MINIMAP_VIEW)).toBeNull();
  });

  it("finds first march by dest for list linkage", () => {
    expect(findFirstMarchByDest(marches, 10, 20)?.march_id).toBe(1);
    expect(findFirstMarchByDest(marches, 99, 99)).toBeUndefined();
  });

  it("picks march id on dest click near layout point", () => {
    const bounds = computeMinimapWorldBounds(5, 5, marches, null);
    const dest = worldToMinimapLayout(10, 20, bounds, MINIMAP_LAYOUT_RECT, DEFAULT_MINIMAP_VIEW);
    const id = findMarchIdForMinimapDestClick(
      dest.x,
      dest.y,
      marches,
      5,
      5,
      DEFAULT_MINIMAP_VIEW,
    );
    expect(id).toBe(1);
  });

  it("pan adjusts view without affecting layout hit rect constant", () => {
    const bounds = computeMinimapWorldBounds(60, 60, [], null);
    const before = { ...DEFAULT_MINIMAP_VIEW };
    const after = applyMinimapPan(before, bounds, 20, 0);
    expect(after.panWx).not.toBe(before.panWx);
    expect(MINIMAP_LAYOUT_RECT.w).toBe(270);
  });

  it("matches list selection by march id", () => {
    expect(marchSelectionMatchesListRow(2, 2)).toBe(true);
    expect(marchSelectionMatchesListRow(2, 3)).toBe(false);
  });

  it("derives scale bar label from minimap stage size and view", () => {
    const bounds = computeMinimapWorldBounds(5, 5, marches, null);
    const bar = computeMinimapScaleBar(bounds, MINIMAP_LAYOUT_RECT, DEFAULT_MINIMAP_VIEW);
    expect(bar.label).toMatch(/^≈\d+格$/);
    expect(bar.barLayoutPx).toBeGreaterThan(8);
    expect(bar.worldUnits).toBeGreaterThan(0);
  });

  it("styles marching vs returning routes; selected wins", () => {
    const marching = minimapMarchRouteStroke(2, false);
    const returning = minimapMarchRouteStroke(4, false);
    expect(marching.dash).toEqual([]);
    expect(returning.dash.length).toBeGreaterThan(0);
    const selected = minimapMarchRouteStroke(4, true);
    expect(selected.lineWidth).toBeGreaterThan(returning.lineWidth);
    expect(selected.dash).toEqual([]);
  });

  it("persists collapsed flag in sessionStorage", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    };
    expect(readMinimapCollapsedFromSession(storage)).toBe(false);
    writeMinimapCollapsedToSession(true, storage);
    expect(storage.getItem(MINIMAP_COLLAPSED_SESSION_KEY)).toBe("1");
    expect(readMinimapCollapsedFromSession(storage)).toBe(true);
  });

  it("collapsed map does not block former minimap slot hits", () => {
    const centerX = MINIMAP_LAYOUT_RECT.x + MINIMAP_LAYOUT_RECT.w / 2;
    const centerY = MINIMAP_LAYOUT_RECT.y + MINIMAP_LAYOUT_RECT.h / 2;
    expect(layoutPointInMinimapMap(centerX, centerY, true)).toBe(false);
    expect(layoutPointInMinimapMap(centerX, centerY, false)).toBe(true);
    expect(layoutPointInMinimapToggle(MINIMAP_LAYOUT_RECT.x + 4, MINIMAP_LAYOUT_RECT.y + 10, true)).toBe(
      true,
    );
  });
});
