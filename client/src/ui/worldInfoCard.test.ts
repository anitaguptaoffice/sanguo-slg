import { describe, expect, it } from "vitest";
import { buildWorldInfoCardSummary, countMarchesAtCell } from "@/ui/worldInfoCard";

describe("worldInfoCard (CLIENT-140)", () => {
  it("countMarchesAtCell ignores completed phases at destination", () => {
    const marches = [
      { march_id: 1, to_x: 10, to_y: 20, phase: 1 },
      { march_id: 2, to_x: 10, to_y: 20, phase: 2 },
      { march_id: 3, to_x: 10, to_y: 20, phase: 0 },
      { march_id: 4, to_x: 11, to_y: 20, phase: 1 },
    ];
    expect(countMarchesAtCell(marches, 10, 20)).toBe(2);
    expect(countMarchesAtCell(marches, 11, 20)).toBe(1);
    expect(countMarchesAtCell(marches, 99, 99)).toBe(0);
  });

  it("buildWorldInfoCardSummary exposes coords and in-progress march line", () => {
    const summary = buildWorldInfoCardSummary({
      cell: { x: 60, y: 60 },
      cities: [{ city_id: 1, name: "主城", x: 60, y: 60, wall_level: 2 }],
      marches: [
        { march_id: 1, to_x: 60, to_y: 60, phase: 1 },
        { march_id: 2, to_x: 60, to_y: 60, phase: 3 },
        { march_id: 3, to_x: 60, to_y: 60, phase: 0 },
      ],
      options: { ownCityX: 50, ownCityY: 50, currentCityId: 1 },
    });
    expect(summary.coordsLine).toBe("格点 (60,60)");
    expect(summary.marchCount).toBe(2);
    expect(summary.marchCountLine).toBe("指向此格进行中行军：2 条");
    expect(summary.cityLine).toContain("城墙 Lv.2");
  });
});
