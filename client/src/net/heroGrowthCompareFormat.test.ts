import { describe, expect, it } from "vitest";
import {
  clampHeroUpgradeProgressPercent,
  formatHeroGrowthCompareStrip,
  formatHeroUpgradeProgressLine,
} from "@/net/heroGrowthCompareFormat";
import { resolveHeroDetailUpgradeProgress } from "@/net/heroMailState";

describe("formatHeroGrowthCompareStrip (CLIENT-198)", () => {
  it("shows level and loyalty next tier when growth path exists", () => {
    expect(
      formatHeroGrowthCompareStrip({
        hero_id: 1,
        level: 2,
        loyalty: 70,
        loyalty_min: 0,
        loyalty_max: 100,
        exp_current: 10,
        exp_to_next: 100,
      }),
    ).toBe("等级 Lv2→Lv3 · 忠诚 70→71");
  });

  it("marks capped level when exp_to_next is zero", () => {
    expect(
      formatHeroGrowthCompareStrip({
        hero_id: 1,
        level: 50,
        loyalty: 99,
        loyalty_max: 100,
        exp_to_next: 0,
      }),
    ).toBe("等级 Lv50（已满） · 忠诚 99→100");
  });

  it("marks loyalty cap at max", () => {
    expect(
      formatHeroGrowthCompareStrip({
        hero_id: 1,
        level: 3,
        loyalty: 100,
        loyalty_max: 100,
      }),
    ).toBe("等级 Lv3→Lv4 · 忠诚 100（已满）");
  });

  it("returns null without hero_id", () => {
    expect(formatHeroGrowthCompareStrip(null)).toBeNull();
    expect(formatHeroGrowthCompareStrip({ level: 1 })).toBeNull();
  });
});

describe("hero upgrade progress percent (CLIENT-198)", () => {
  it("clampHeroUpgradeProgressPercent rounds and clamps", () => {
    expect(clampHeroUpgradeProgressPercent(40, 100)).toBe(40);
    expect(clampHeroUpgradeProgressPercent(150, 100)).toBe(100);
    expect(clampHeroUpgradeProgressPercent(-5, 100)).toBe(0);
    expect(clampHeroUpgradeProgressPercent(1, 0)).toBeNull();
  });

  it("resolveHeroDetailUpgradeProgress percent matches clamp helper", () => {
    const progress = resolveHeroDetailUpgradeProgress({
      hero_id: 1,
      level: 3,
      exp_current: 25,
      exp_to_next: 100,
      loyalty: 40,
      loyalty_min: 0,
      loyalty_max: 100,
    });
    expect(progress.mode).toBe("bars");
    if (progress.mode !== "bars") return;
    const expBar = progress.bars.find((b) => b.kind === "level_exp");
    expect(expBar?.percent).toBe(clampHeroUpgradeProgressPercent(25, 100));
    const loyaltyBar = progress.bars.find((b) => b.kind === "loyalty");
    expect(loyaltyBar?.percent).toBe(clampHeroUpgradeProgressPercent(40, 100));
    if (expBar) {
      expect(formatHeroUpgradeProgressLine(expBar)).toBe("Lv3 · 25/100 · 25%");
    }
  });
});
