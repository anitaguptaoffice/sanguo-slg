import { describe, expect, it } from "vitest";
import {
  extractBattleReportReplayCoord,
  formatBattleReportReplayStatusCollapsed,
  formatBattleReportReplayStatusExpanded,
} from "@/net/battleReportReplayCoord";

describe("battleReportReplayCoord", () => {
  it("extracts location_x/y when both are finite numbers", () => {
    expect(extractBattleReportReplayCoord({ location_x: 12, location_y: 34 })).toEqual({
      wx: 12,
      wy: 34,
    });
    expect(extractBattleReportReplayCoord({ location_x: 0, location_y: 0 })).toEqual({
      wx: 0,
      wy: 0,
    });
  });

  it("returns null when coordinates are missing or invalid", () => {
    expect(extractBattleReportReplayCoord(undefined)).toBeNull();
    expect(extractBattleReportReplayCoord({ location_x: 1 })).toBeNull();
    expect(extractBattleReportReplayCoord({ location_y: 2 })).toBeNull();
    expect(extractBattleReportReplayCoord({ location_x: Number.NaN, location_y: 1 })).toBeNull();
  });

  it("formats status hints for expanded vs collapsed minimap", () => {
    const c = { wx: 8, wy: 9 };
    expect(formatBattleReportReplayStatusExpanded(c)).toContain("(8,9)");
    expect(formatBattleReportReplayStatusExpanded(c)).toContain("小地图已高亮");
    expect(formatBattleReportReplayStatusCollapsed(c)).toContain("展开小地图");
  });
});
