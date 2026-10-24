import { describe, expect, it } from "vitest";
import {
  MINIMAP_MARCH_STACK_BADGE_CLASS,
  countMarchesAtTile,
  formatMinimapMarchStackBadgeLabel,
  formatWorldTileMarchSummaryLine,
  findMostRecentInProgressMarchAtTile,
  layoutMinimapMarchStackBadges,
  syncMinimapMarchStackBadgeClass,
} from "@/ui/minimapMarchStack";
import { WORLD_TILE_MARCH_SUMMARY_EMPTY_HINT } from "@/ui/minimapMarchStack";
import { WORLD_TILE_NO_RECENT_MARCH_HINT } from "@/ui/worldTileInfoCard";

describe("countMarchesAtTile", () => {
  it("counts only in-progress marches at destination", () => {
    const marches = [
      { march_id: 1, to_x: 10, to_y: 20, phase: 2 },
      { march_id: 2, to_x: 10, to_y: 20, phase: 3 },
      { march_id: 3, to_x: 10, to_y: 20, phase: 5 },
      { march_id: 4, to_x: 11, to_y: 20, phase: 2 },
    ];
    expect(countMarchesAtTile(marches, 10, 20)).toBe(2);
    expect(countMarchesAtTile(marches, 11, 20)).toBe(1);
    expect(countMarchesAtTile(marches, 0, 0)).toBe(0);
  });
});

describe("formatMinimapMarchStackBadgeLabel", () => {
  it("returns ×N for stacks and null for single or zero", () => {
    expect(formatMinimapMarchStackBadgeLabel(3)).toBe("×3");
    expect(formatMinimapMarchStackBadgeLabel(2)).toBe("×2");
    expect(formatMinimapMarchStackBadgeLabel(1)).toBeNull();
    expect(formatMinimapMarchStackBadgeLabel(0)).toBeNull();
  });

  it("exports stack badge class hook", () => {
    expect(MINIMAP_MARCH_STACK_BADGE_CLASS).toBe("minimap-march-stack-badge");
  });
});

describe("formatWorldTileMarchSummaryLine", () => {
  const now = Date.UTC(2026, 9, 24, 12, 0, 0);

  it("picks most recent in-progress march by depart_at_ms", () => {
    const marches = [
      { march_id: 10, to_x: 3, to_y: 4, phase: 1, depart_at_ms: now - 60_000 },
      { march_id: 11, to_x: 3, to_y: 4, phase: 2, depart_at_ms: now, arrive_at_ms: now + 30 * 60_000 },
    ];
    expect(findMostRecentInProgressMarchAtTile(marches, 3, 4)?.march_id).toBe(11);
    const line = formatWorldTileMarchSummaryLine(marches, { x: 3, y: 4 }, now);
    expect(line).toContain("最近终点行军 #11");
    expect(line).toContain("剩余 30m");
    expect(line).toContain("行军中");
  });

  it("returns hint when no in-progress march at tile", () => {
    expect(WORLD_TILE_MARCH_SUMMARY_EMPTY_HINT).toBe(WORLD_TILE_NO_RECENT_MARCH_HINT);
    expect(formatWorldTileMarchSummaryLine([], { x: 1, y: 2 })).toBe(
      WORLD_TILE_MARCH_SUMMARY_EMPTY_HINT,
    );
  });
});

describe("syncMinimapMarchStackBadgeClass", () => {
  it("toggles layout-frame class when any dest has stack", () => {
    const el = document.createElement("div");
    syncMinimapMarchStackBadgeClass(
      [
        { march_id: 1, to_x: 1, to_y: 1, phase: 2 },
        { march_id: 2, to_x: 1, to_y: 1, phase: 2 },
      ],
      el,
    );
    expect(el.classList.contains("minimap-march-stack-badge")).toBe(true);
    syncMinimapMarchStackBadgeClass(
      [{ march_id: 1, to_x: 1, to_y: 1, phase: 2 }],
      el,
    );
    expect(el.classList.contains("minimap-march-stack-badge")).toBe(false);
  });
});

describe("layoutMinimapMarchStackBadges", () => {
  it("lays out badge only when count > 1", () => {
    const marches = [
      { march_id: 1, to_x: 5, to_y: 5, phase: 2 },
      { march_id: 2, to_x: 5, to_y: 5, phase: 2 },
      { march_id: 3, to_x: 6, to_y: 5, phase: 2 },
    ];
    const badges = layoutMinimapMarchStackBadges(
      marches,
      [{ wx: 5, wy: 5 }, { wx: 6, wy: 5 }],
      (wx, wy) => ({ x: wx * 10, y: wy * 10 }),
    );
    expect(badges).toHaveLength(1);
    expect(badges[0].label).toBe("×2");
    expect(badges[0].x).toBe(58);
    expect(badges[0].y).toBe(40);
  });
});
