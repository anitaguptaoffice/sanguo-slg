import { describe, expect, it } from "vitest";
import {
  buildWorldTileInfoCardSummary,
  formatCityLevelLine,
  formatDerivedResourceTileLabel,
  formatMarchCountInfoLine,
  formatResourceTileTypeFromField,
} from "@/ui/worldTileInfoCard";

describe("worldTileInfoCard", () => {
  it("summarizes city grid with wall level and march count", () => {
    const summary = buildWorldTileInfoCardSummary({
      x: 60,
      y: 60,
      currentCityId: 1,
      ownCityX: 50,
      ownCityY: 50,
      cities: [{ city_id: 1, name: "主城", x: 60, y: 60, is_capital: true, wall_level: 3 }],
      marches: [
        { march_id: 1, to_x: 60, to_y: 60 },
        { march_id: 2, to_x: 10, to_y: 10 },
        { march_id: 3, to_x: 60, to_y: 60 },
      ],
    });
    expect(summary.coordsLine).toBe("格点 (60,60)");
    expect(summary.cityLine).toBe("主城 · 城墙 Lv.3 · 主城");
    expect(summary.marchCount).toBe(2);
    expect(summary.marchCountLine).toBe("指向此格行军：2 条");
    expect(summary.manhattanLine).toBe("距主城曼哈顿 20 格");
  });

  it("uses tile_resource_type when present on city snapshot", () => {
    const summary = buildWorldTileInfoCardSummary({
      x: 5,
      y: 5,
      cities: [{ city_id: 2, name: "分城", x: 5, y: 5, tile_resource_type: "wood" }],
      marches: [],
    });
    expect(summary.terrainLine).toBe("资源格：林地");
  });

  it("derives resource label for empty grid cells", () => {
    const label = formatDerivedResourceTileLabel(12, 34);
    expect(label).toMatch(/粮田|林地|石矿|铁矿/);
    const summary = buildWorldTileInfoCardSummary({
      x: 12,
      y: 34,
      cities: [],
      marches: [],
    });
    expect(summary.cityLine).toBeNull();
    expect(summary.terrainLine).toContain("坐标派生");
    expect(summary.marchCount).toBe(0);
    expect(formatMarchCountInfoLine(0)).toBe("指向此格行军：暂无");
  });

  it("formatResourceTileTypeFromField maps known keys", () => {
    expect(formatResourceTileTypeFromField("iron")).toBe("铁矿");
    expect(formatResourceTileTypeFromField(2)).toBe("林地");
    expect(formatCityLevelLine({ city_id: 9, name: "边城", wall_level: 5 })).toContain("城墙 Lv.5");
  });
});
