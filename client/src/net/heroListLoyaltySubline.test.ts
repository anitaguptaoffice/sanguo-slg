import { describe, expect, it } from "vitest";
import { HERO_LIST_DEPLOYABLE_MIN_LOYALTY } from "@/net/heroListFilter";
import {
  formatHeroListLoyaltySubline,
  heroListRowShowsLoyaltyWarnDot,
  normalizeListPlayerHeroSummary,
} from "@/net/heroListLoyaltySubline";

describe("formatHeroListLoyaltySubline (CLIENT-213)", () => {
  it("summarizes loyalty deployable state and optional morale", () => {
    expect(
      formatHeroListLoyaltySubline({ hero_id: 1, loyalty: 80 }),
    ).toBe("忠诚 80 · 可出征");
    expect(
      formatHeroListLoyaltySubline({
        hero_id: 2,
        loyalty: HERO_LIST_DEPLOYABLE_MIN_LOYALTY - 1,
        morale: 55,
      }),
    ).toBe(`忠诚 ${HERO_LIST_DEPLOYABLE_MIN_LOYALTY - 1} · 士气 55 · 不可出征`);
  });

  it("respects detail loyalty_min in filter context", () => {
    const ctx = { detailLoyaltyMinByHeroId: new Map([[3, 50]]) };
    expect(formatHeroListLoyaltySubline({ hero_id: 3, loyalty: 45 }, ctx)).toContain(
      "不可出征",
    );
    expect(formatHeroListLoyaltySubline({ hero_id: 3, loyalty: 55 }, ctx)).toContain("可出征");
  });

  it("warn dot when below deployable threshold", () => {
    expect(heroListRowShowsLoyaltyWarnDot({ hero_id: 1, loyalty: 10 })).toBe(true);
    expect(heroListRowShowsLoyaltyWarnDot({ hero_id: 1, loyalty: 90 })).toBe(false);
  });

  it("normalizeListPlayerHeroSummary reads morale soft field", () => {
    expect(
      normalizeListPlayerHeroSummary({
        hero_id: 1,
        template_cfg_id: 1001,
        level: 2,
        loyalty: 40,
        morale_value: 72,
      }),
    ).toEqual({
      hero_id: 1,
      template_cfg_id: 1001,
      level: 2,
      loyalty: 40,
      morale: 72,
    });
  });
});
