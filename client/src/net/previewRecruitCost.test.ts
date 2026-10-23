import { describe, expect, it } from "vitest";
import { previewRecruitCost } from "@/net/previewRecruitCost";
import { scaleTroopRecruitCost, troopRecruitSpecForCfgId } from "@/net/troopRecruitCatalog";

describe("previewRecruitCost", () => {
  it("matches DefaultUnitCatalog per-unit cost scaled by qty", () => {
    const spec = troopRecruitSpecForCfgId(1);
    expect(spec).toBeDefined();
    expect(scaleTroopRecruitCost(spec!.recruitCostPerUnit, 10)).toEqual({
      food: 400,
      wood: 200,
      stone: 0,
      iron: 0,
    });
    const preview = previewRecruitCost(1, 10, undefined);
    expect(preview?.timeSec).toBe(300);
    expect(preview?.summaryLine).toContain("步兵×10");
    expect(preview?.summaryLine).toContain("耗时 5:00");
  });

  it("compares wallet and builds insufficient hint (CLIENT-067)", () => {
    const preview = previewRecruitCost(2, 5, {
      food: 10_000,
      wood: 10,
      stone: 0,
      iron: 0,
    });
    expect(preview?.canAfford).toBe(false);
    expect(preview?.insufficientHint).toMatch(/^缺少：/);
    expect(preview?.insufficientHint).toContain("木");
    expect(preview?.insufficientHint).toContain("铁");
  });

  it("marks affordable when wallet covers batch cost", () => {
    const preview = previewRecruitCost(1, 20, {
      food: 10_000,
      wood: 10_000,
      stone: 0,
      iron: 0,
    });
    expect(preview?.canAfford).toBe(true);
    expect(preview?.insufficientHint).toBeNull();
  });

  it("returns null for unknown unit or non-positive qty", () => {
    expect(previewRecruitCost(99, 10, {})).toBeNull();
    expect(previewRecruitCost(1, 0, {})).toBeNull();
  });
});
