import { describe, expect, it } from "vitest";
import {
  estimateGoldLargessCost,
  filterLargessBagItemIds,
  formatHeroLargessSuccessStatus,
  formatLargessCooldownLine,
  isLargessOnCooldown,
  largessCooldownRemainingMs,
  parseLargessHeroResponse,
  validateHeroDetailLargessSubmit,
} from "@/net/heroDetailLargess";

const detailBase = {
  hero_id: 3,
  level: 10,
  loyalty: 70,
  loyalty_min: 0,
  loyalty_max: 100,
  attributes: { force: 60, intel: 70, politics: 80, command: 65 },
};

describe("parseLargessHeroResponse", () => {
  it("normalizes snake and camel fields", () => {
    expect(
      parseLargessHeroResponse({
        heroId: 3,
        loyalty: 85,
        loyaltyDelta: 15,
        goldSpent: 500,
        nextLargessAtMs: 1_700_000_000_000,
      }),
    ).toEqual({
      hero_id: 3,
      loyalty: 85,
      loyalty_delta: 15,
      gold_spent: 500,
      item_cfg_id: undefined,
      next_largess_at_ms: 1_700_000_000_000,
    });
  });
});

describe("estimateGoldLargessCost", () => {
  it("matches level-based salary ×5", () => {
    expect(estimateGoldLargessCost(detailBase)).toBe(10 * 20 * 5);
  });
});

describe("largess cooldown", () => {
  it("blocks when next_at is in the future", () => {
    const now = 1_000_000;
    const next = now + 90_000;
    expect(largessCooldownRemainingMs(next, now)).toBe(90_000);
    expect(isLargessOnCooldown(next, now)).toBe(true);
    expect(formatLargessCooldownLine(next, now)).toContain("赏赐冷却");
  });

  it("allows submit when cooldown elapsed", () => {
    const now = 2_000_000;
    expect(isLargessOnCooldown(1_000_000, now)).toBe(false);
  });
});

describe("validateHeroDetailLargessSubmit", () => {
  it("rejects during cooldown", () => {
    const now = 5_000;
    const r = validateHeroDetailLargessSubmit(
      detailBase,
      [],
      { gold: 999_999 },
      "gold",
      null,
      now + 60_000,
      now,
    );
    expect(r.ok).toBe(false);
    expect(r.message).toContain("冷却");
  });

  it("accepts gold when wallet sufficient", () => {
    const r = validateHeroDetailLargessSubmit(detailBase, [], { gold: 50_000 }, "gold", null, 0, Date.now());
    expect(r.ok).toBe(true);
  });

  it("accepts item gift from bag", () => {
    const r = validateHeroDetailLargessSubmit(
      detailBase,
      [{ item_cfg_id: 2051, quantity: 2 }],
      {},
      "item",
      2051,
      0,
      Date.now(),
    );
    expect(r.ok).toBe(true);
    expect(r.itemCfgId).toBe(2051);
  });

  it("rejects item gift when bag empty", () => {
    const r = validateHeroDetailLargessSubmit(detailBase, [], {}, "item", null, 0, Date.now());
    expect(r.ok).toBe(false);
    expect(r.message).toContain("赏赐礼");
  });
});

describe("filterLargessBagItemIds", () => {
  it("returns only configured largess items with qty", () => {
    expect(
      filterLargessBagItemIds([
        { item_cfg_id: 2017, quantity: 1 },
        { item_cfg_id: 2050, quantity: 3 },
      ]),
    ).toEqual([2050]);
  });
});

describe("formatHeroLargessSuccessStatus", () => {
  it("shows loyalty delta and spend", () => {
    const text = formatHeroLargessSuccessStatus(
      { hero_id: 3, loyalty: 70 },
      { loyalty: 85, loyalty_delta: 15, item_cfg_id: 2051, next_largess_at_ms: Date.now() + 900_000 },
    );
    expect(text).toContain("70→85");
    expect(text).toContain("+15");
    expect(text).toContain("赏赐礼·拾");
  });
});
