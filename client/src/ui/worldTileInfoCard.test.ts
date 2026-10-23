import { describe, expect, it } from "vitest";
import {
  buildWorldTileInfoCardSummary,
  formatCityLevelLine,
  formatDerivedResourceTileLabel,
  formatMarchCountInfoLine,
  formatResourceTileTypeFromField,
  formatWorldTileInfoCard,
  formatWorldTileOccupationHint,
  resolveWorldTilePlayerLine,
  WORLD_TILE_NO_OCCUPATION_HINT,
} from "@/ui/worldTileInfoCard";

describe("formatWorldTileInfoCard", () => {
  it("summarizes city grid with wall level and march count", () => {
    const summary = formatWorldTileInfoCard(
      { x: 60, y: 60 },
      [{ city_id: 1, name: "主城", x: 60, y: 60, is_capital: true, wall_level: 3 }],
      [
        { march_id: 1, to_x: 60, to_y: 60 },
        { march_id: 2, to_x: 10, to_y: 10 },
        { march_id: 3, to_x: 60, to_y: 60 },
      ],
      { currentCityId: 1, ownCityX: 50, ownCityY: 50 },
    );
    expect(summary.coordsLine).toBe("格点 (60,60)");
    expect(summary.cityLine).toBe("主城 · 城墙 Lv.3 · 主城");
    expect(summary.marchCount).toBe(2);
    expect(summary.marchCountLine).toBe("指向此格行军：2 条");
    expect(summary.manhattanLine).toBe("距主城曼哈顿 20 格");
    expect(summary.occupationHintLine).toBeNull();
  });

  it("uses tile_resource_type when present on city snapshot", () => {
    const summary = formatWorldTileInfoCard(
      { x: 5, y: 5 },
      [{ city_id: 2, name: "分城", x: 5, y: 5, tile_resource_type: "wood" }],
      [],
    );
    expect(summary.terrainLine).toBe("资源格：林地");
  });

  it("shows player name from city or march snapshot and neutral hint when absent", () => {
    const withCityPlayer = formatWorldTileInfoCard(
      { x: 1, y: 1 },
      [{ city_id: 3, name: "边城", x: 1, y: 1, player_name: "刘备" }],
      [],
    );
    expect(withCityPlayer.playerLine).toBe("刘备");
    expect(withCityPlayer.occupationHintLine).toBeNull();

    const withMarchPlayer = formatWorldTileInfoCard(
      { x: 2, y: 2 },
      [],
      [{ march_id: 1, to_x: 2, to_y: 2, to_player_name: "曹操" }],
    );
    expect(withMarchPlayer.playerLine).toBe("曹操");

    const empty = formatWorldTileInfoCard({ x: 12, y: 34 }, [], []);
    expect(empty.cityLine).toBeNull();
    expect(empty.playerLine).toBeNull();
    expect(empty.occupationHintLine).toBe(WORLD_TILE_NO_OCCUPATION_HINT);
    expect(empty.terrainLine).toContain("坐标派生");
    expect(empty.marchCount).toBe(0);
    expect(formatMarchCountInfoLine(0)).toBe("指向此格行军：暂无");
  });

  it("links recent battle report at grid within time window (CLIENT-065)", () => {
    const now = Date.UTC(2026, 9, 23, 12, 0, 0);
    const summary = formatWorldTileInfoCard(
      { x: 8, y: 8 },
      [],
      [],
      {
        battleReports: [
          { report_id: 1, location_x: 8, location_y: 8, created_at_ms: now - 1000 },
          { report_id: 2, location_x: 9, location_y: 9, created_at_ms: now },
        ],
        battleReportTimeWindow: "all",
        nowMs: now,
      },
    );
    expect(summary.recentBattleReportId).toBe(1);
    expect(summary.showBattleReportShortcut).toBe(true);
  });

  it("formatResourceTileTypeFromField maps known keys", () => {
    expect(formatResourceTileTypeFromField("iron")).toBe("铁矿");
    expect(formatResourceTileTypeFromField(2)).toBe("林地");
    expect(formatCityLevelLine({ city_id: 9, name: "边城", wall_level: 5 })).toContain("城墙 Lv.5");
    expect(formatDerivedResourceTileLabel(12, 34)).toMatch(/粮田|林地|石矿|铁矿/);
    expect(resolveWorldTilePlayerLine(undefined, [{ to_x: 1, to_y: 1, target_display_name: "吕布" }])).toBe(
      "吕布",
    );
    expect(formatWorldTileOccupationHint(undefined, null)).toBe(WORLD_TILE_NO_OCCUPATION_HINT);
  });

  it("buildWorldTileInfoCardSummary remains compatible", () => {
    const summary = buildWorldTileInfoCardSummary({
      x: 1,
      y: 2,
      cities: [],
      marches: [],
    });
    expect(summary.coordsLine).toContain("(1,2)");
  });
});
