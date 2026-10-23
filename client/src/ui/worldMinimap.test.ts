import { describe, expect, it } from "vitest";
import type { MarchSummary } from "@/net/militaryFormat";
import {
  MINIMAP_LAYOUT_RECT,
  applyMinimapPan,
  collectMinimapDestMarkers,
  computeMinimapWorldBounds,
  findFirstMarchByDest,
  findMarchIdForMinimapDestClick,
  layoutPointInMinimap,
  marchSelectionMatchesListRow,
  marchShowsDestOnMinimap,
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
});
