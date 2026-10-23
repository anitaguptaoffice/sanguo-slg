import { describe, expect, it } from "vitest";
import {
  computeUpgradeCostAtLevel,
  formatUpgradeDurationSec,
  formatUpgradeInsufficientHint,
  previewUpgradeCost,
} from "@/net/previewUpgradeCost";

describe("previewUpgradeCost", () => {
  it("matches domestic upCost/upDur for farm Lv1→2", () => {
    const computed = computeUpgradeCostAtLevel(2, 2);
    expect(computed).toEqual({
      cost: { food: 80, wood: 240, stone: 48, iron: 0 },
      timeSec: 67,
    });
  });

  it("previewUpgradeCost compares wallet and builds summary", () => {
    const preview = previewUpgradeCost("farm", 1, {
      food: 10_000,
      wood: 100,
      stone: 10_000,
      iron: 0,
    });
    expect(preview?.targetLevel).toBe(2);
    expect(preview?.canAfford).toBe(false);
    expect(preview?.insufficientHint).toMatch(/^缺少：/);
    expect(preview?.insufficientHint).toContain("木");
    expect(preview?.summaryLine).toContain("升至 Lv2");
    expect(preview?.summaryLine).toContain("耗时");
  });

  it("marks affordable when wallet covers cost", () => {
    const preview = previewUpgradeCost("farm", 1, {
      food: 10_000,
      wood: 10_000,
      stone: 10_000,
      iron: 0,
    });
    expect(preview?.canAfford).toBe(true);
    expect(preview?.insufficientHint).toBeNull();
  });

  it("formatUpgradeInsufficientHint lists shortfalls only", () => {
    expect(
      formatUpgradeInsufficientHint(
        { food: 50, wood: 200, stone: 0, iron: 0 },
        { food: 80, wood: 240, stone: 48, iron: 0 },
      ),
    ).toBe("缺少：粮 30 · 木 40 · 石 48");
  });

  it("formatUpgradeDurationSec omits 剩 prefix", () => {
    expect(formatUpgradeDurationSec(67)).toBe("1:07");
    expect(formatUpgradeDurationSec(45)).toBe("0:45");
    expect(formatUpgradeDurationSec(3661)).toBe("1:01:01");
  });
});
