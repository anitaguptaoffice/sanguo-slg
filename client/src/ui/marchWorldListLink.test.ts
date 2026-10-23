import { describe, expect, it } from "vitest";
import {
  appendManhattanToStatus,
  countMarchesToDestination,
  filterMarchesByDestination,
  findFirstMarchIdAtDestination,
  formatWorldCityMarchDestCount,
  gridCellsMatch,
  manhattanGridDistance,
  marchDestinationMatchesGrid,
} from "@/ui/marchWorldListLink";

describe("marchWorldListLink", () => {
  it("gridCellsMatch requires finite equal coords", () => {
    expect(gridCellsMatch(3, 4, 3, 4)).toBe(true);
    expect(gridCellsMatch(3, 4, 3, 5)).toBe(false);
    expect(gridCellsMatch(undefined, 4, 3, 4)).toBe(false);
  });

  it("manhattanGridDistance uses L1 on grid", () => {
    expect(manhattanGridDistance(60, 60, 63, 58)).toBe(5);
    expect(manhattanGridDistance(60, 60, 60, 60)).toBe(0);
    expect(manhattanGridDistance(NaN, 60, 10, 10)).toBeNull();
  });

  it("marchDestinationMatchesGrid and filter snapshot", () => {
    const marches = [
      { march_id: 1, to_x: 10, to_y: 20 },
      { march_id: 2, to_x: 10, to_y: 21 },
      { march_id: 3, to_x: 5, to_y: 5 },
    ];
    expect(marchDestinationMatchesGrid(marches[0], 10, 20)).toBe(true);
    expect(filterMarchesByDestination(marches, 10, 20).map((m) => m.march_id)).toEqual([1]);
  });

  it("appendManhattanToStatus keeps base when coords missing", () => {
    expect(appendManhattanToStatus("出征目标 (1,2)", 60, 60, 1, 2)).toContain("距主城曼哈顿");
    expect(appendManhattanToStatus("仅文案", undefined, 60, 1, 2)).toBe("仅文案");
  });

  it("countMarchesToDestination and formatWorldCityMarchDestCount", () => {
    const marches = [
      { march_id: 1, to_x: 10, to_y: 20 },
      { march_id: 2, to_x: 10, to_y: 20 },
      { march_id: 3, to_x: 1, to_y: 1 },
    ];
    expect(countMarchesToDestination(marches, 10, 20)).toBe(2);
    expect(formatWorldCityMarchDestCount(2)).toBe("指向此格的行军 2 条");
    expect(formatWorldCityMarchDestCount(0)).toBeNull();
    expect(findFirstMarchIdAtDestination(marches, 10, 20)).toBe(1);
    expect(findFirstMarchIdAtDestination(marches, 99, 99)).toBeNull();
  });
});
