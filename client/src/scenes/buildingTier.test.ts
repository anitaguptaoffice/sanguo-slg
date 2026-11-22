import { describe, expect, it } from "vitest";
import { buildingTier } from "./MainCityScene";

describe("buildingTier", () => {
  it("maps level ranges to original art tiers", () => {
    expect(buildingTier(0)).toBe(1);
    expect(buildingTier(1)).toBe(1);
    expect(buildingTier(3)).toBe(1);
    expect(buildingTier(4)).toBe(4);
    expect(buildingTier(6)).toBe(4);
    expect(buildingTier(7)).toBe(7);
    expect(buildingTier(9)).toBe(7);
    expect(buildingTier(10)).toBe(10);
    expect(buildingTier(30)).toBe(10);
  });
});
