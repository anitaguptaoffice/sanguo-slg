import { describe, expect, it } from "vitest";
import {
  formatHeroDetailCultivationUseStatus,
  formatHeroDetailStatChangeSummary,
  heroDetailCultivationUseButtonLabel,
  pickHeroCultivationUseItemCfgId,
  validateHeroDetailCultivationUse,
} from "@/net/heroDetailCultivationUse";
import { USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL } from "@/net/useConsumableSubmitFeedback";

describe("pickHeroCultivationUseItemCfgId", () => {
  it("returns first cultivation consumable with qty", () => {
    expect(
      pickHeroCultivationUseItemCfgId([
        { item_cfg_id: 2001, quantity: 5 },
        { item_cfg_id: 2017, quantity: 2 },
      ]),
    ).toBe(2017);
  });
});

describe("validateHeroDetailCultivationUse", () => {
  it("rejects empty bag with readable Chinese", () => {
    const r = validateHeroDetailCultivationUse([]);
    expect(r.ok).toBe(false);
    expect(r.message).toContain("养成消耗品");
  });

  it("accepts when 2017 is in bag", () => {
    const r = validateHeroDetailCultivationUse([{ item_cfg_id: 2017, quantity: 1 }]);
    expect(r.ok).toBe(true);
    expect(r.itemCfgId).toBe(2017);
  });
});

describe("formatHeroDetailStatChangeSummary", () => {
  it("shows level and loyalty deltas", () => {
    expect(
      formatHeroDetailStatChangeSummary(
        { hero_id: 1, level: 2, loyalty: 70 },
        { hero_id: 1, level: 3, loyalty: 85 },
      ),
    ).toBe("等级 Lv2→Lv3 · 忠诚 70→85");
  });

  it("shows stable values when unchanged", () => {
    expect(
      formatHeroDetailStatChangeSummary(
        { hero_id: 1, level: 2, loyalty: 77 },
        { hero_id: 1, level: 2, loyalty: 77 },
      ),
    ).toBe("等级 Lv2 · 忠诚 77");
  });
});

describe("formatHeroDetailCultivationUseStatus", () => {
  it("combines item, stat summary, and server effect", () => {
    expect(
      formatHeroDetailCultivationUseStatus(2017, "等级 Lv2→Lv3 · 忠诚 70→85", "忠诚+5"),
    ).toContain("将魂碎晶");
    expect(
      formatHeroDetailCultivationUseStatus(2017, "等级 Lv2 · 忠诚 77", ""),
    ).toBe("已使用 将魂碎晶×1：等级 Lv2 · 忠诚 77");
  });
});

describe("heroDetailCultivationUseButtonLabel", () => {
  it("shows inflight label while submitting", () => {
    expect(heroDetailCultivationUseButtonLabel("submitting")).toBe(USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL);
    expect(heroDetailCultivationUseButtonLabel("idle")).toBe("使用养成道具");
  });
});
