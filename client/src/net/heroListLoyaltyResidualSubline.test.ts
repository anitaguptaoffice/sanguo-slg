import { describe, expect, it } from "vitest";
import { HERO_LIST_DEPLOYABLE_MIN_LOYALTY } from "@/net/heroListFilter";
import {
  formatHeroListLoyaltyResidualSubline,
  heroListRowShowsLoyaltyResidualWarnDot,
} from "@/net/heroListLoyaltyResidualSubline";

describe("formatHeroListLoyaltyResidualSubline (CLIENT-246)", () => {
  it("summarizes loyalty threshold and deployable state", () => {
    expect(formatHeroListLoyaltyResidualSubline({ hero_id: 1, loyalty: 80 })).toContain(
      "达阈可出征",
    );
    expect(
      formatHeroListLoyaltyResidualSubline({
        hero_id: 2,
        loyalty: HERO_LIST_DEPLOYABLE_MIN_LOYALTY - 5,
      }),
    ).toContain("未达阈不可出征");
    expect(
      formatHeroListLoyaltyResidualSubline({
        hero_id: 2,
        loyalty: HERO_LIST_DEPLOYABLE_MIN_LOYALTY - 5,
      }),
    ).toContain("低忠诚警示");
  });

  it("respects detail loyalty_min in filter context", () => {
    const ctx = { detailLoyaltyMinByHeroId: new Map([[3, 50]]) };
    expect(formatHeroListLoyaltyResidualSubline({ hero_id: 3, loyalty: 45 }, ctx)).toContain(
      "阈50",
    );
    expect(heroListRowShowsLoyaltyResidualWarnDot({ hero_id: 3, loyalty: 45 }, ctx)).toBe(true);
  });
});
