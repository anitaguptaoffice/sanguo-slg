import { describe, expect, it } from "vitest";
import {
  applyBattleReportMinimapFocus,
  formatBattleReportLocationFields,
  parseBattleReportLocation,
} from "@/net/battleReportMinimapFocus";
import { DEFAULT_MINIMAP_VIEW, computeMinimapWorldBounds } from "@/ui/worldMinimap";

describe("battleReportMinimapFocus", () => {
  it("parseBattleReportLocation reads finite location_x/y", () => {
    expect(parseBattleReportLocation({ location_x: 12, location_y: 34 })).toEqual({
      x: 12,
      y: 34,
    });
    expect(parseBattleReportLocation({ location_x: 0, location_y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it("parseBattleReportLocation rejects missing or invalid coords", () => {
    expect(parseBattleReportLocation(undefined)).toBeNull();
    expect(parseBattleReportLocation({ location_x: 1 })).toBeNull();
    expect(parseBattleReportLocation({ location_y: 2 })).toBeNull();
    expect(parseBattleReportLocation({ location_x: Number.NaN, location_y: 1 })).toBeNull();
  });

  it("formatBattleReportLocationFields labels proto field names", () => {
    expect(formatBattleReportLocationFields({ x: 8, y: 9 })).toBe(
      "location_x=8 · location_y=9",
    );
  });

  it("applyBattleReportMinimapFocus frames minimap and returns world grid", () => {
    const bounds = computeMinimapWorldBounds(5, 5, [], null);
    const applied = applyBattleReportMinimapFocus(
      { x: 10, y: 20 },
      bounds,
      DEFAULT_MINIMAP_VIEW,
    );
    expect(applied.replay).toEqual({ wx: 10, wy: 20 });
    expect(applied.focusGrid).toEqual({ wx: 10, wy: 20 });
    expect(applied.worldGrid).toEqual({ x: 10, y: 20 });
    expect(applied.view.zoom).toBeGreaterThan(1);
    expect(applied.status).toContain("(10,20)");
    expect(applied.status).toContain("小地图已高亮");
  });
});
