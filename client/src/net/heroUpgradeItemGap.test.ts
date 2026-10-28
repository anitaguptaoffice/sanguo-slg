// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  evaluateHeroUpgradeItemGap,
  formatHeroUpgradeItemGap,
  heroUpgradeItemGapDisabledReason,
  resolveHeroLevelUpgradeItemNeed,
  resolveHeroLoyaltyUpgradeItemNeed,
} from "@/net/heroUpgradeItemGap";
import type { HeroDetail } from "@/net/heroMailState";

describe("formatHeroUpgradeItemGap (CLIENT-165)", () => {
  const detailBase: HeroDetail = {
    hero_id: 3,
    template_cfg_id: 1001,
    level: 2,
    loyalty: 70,
    loyalty_min: 0,
    loyalty_max: 100,
    exp_current: 10,
    exp_to_next: 100,
  };

  it("resolveHeroLevelUpgradeItemNeed prefers gateway field", () => {
    expect(
      resolveHeroLevelUpgradeItemNeed({
        ...detailBase,
        level_upgrade_item: { item_cfg_id: 2004, quantity: 2 },
      }),
    ).toEqual({ itemCfgId: 2004, quantity: 2 });
  });

  it("resolveHeroLoyaltyUpgradeItemNeed falls back to 2017 when below max", () => {
    expect(resolveHeroLoyaltyUpgradeItemNeed(detailBase)).toEqual({ itemCfgId: 2017, quantity: 1 });
    expect(
      resolveHeroLoyaltyUpgradeItemNeed({ ...detailBase, loyalty: 100, loyalty_max: 100 }),
    ).toBeNull();
  });

  it("formatHeroUpgradeItemGap compares need vs bag", () => {
    expect(formatHeroUpgradeItemGap({ itemCfgId: 2017, quantity: 2 }, [{ item_cfg_id: 2017, quantity: 1 }])).toBe(
      "#2017 将魂碎晶 需2/持1 缺口1",
    );
    expect(formatHeroUpgradeItemGap({ itemCfgId: 2017, quantity: 1 }, [{ item_cfg_id: 2017, quantity: 3 }])).toBe(
      "#2017 将魂碎晶 需1/持3",
    );
  });

  it("evaluateHeroUpgradeItemGap marks sufficient", () => {
    const gap = evaluateHeroUpgradeItemGap({ itemCfgId: 2017, quantity: 1 }, []);
    expect(gap.sufficient).toBe(false);
    expect(gap.shortfall).toBe(1);
  });

  it("heroUpgradeItemGapDisabledReason joins level and loyalty gaps", () => {
    const reason = heroUpgradeItemGapDisabledReason(detailBase, []);
    expect(reason).toMatch(/升级/);
    expect(reason).toMatch(/忠诚/);
    expect(reason).toMatch(/缺口/);
    expect(heroUpgradeItemGapDisabledReason(detailBase, [{ item_cfg_id: 2017, quantity: 99 }])).toBeNull();
  });
});
