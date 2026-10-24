import { describe, expect, it } from "vitest";
import {
  formatHeroListLoyaltyResidualDeepSubline,
  heroListRowShowsLoyaltyResidualDeepWarnDot,
} from "@/net/heroListLoyaltyResidualDeepSubline";

describe("formatHeroListLoyaltyResidualDeepSubline (CLIENT-262)", () => {
  it("includes loyalty exp progress and CLIENT-246 residual scan", () => {
    expect(
      formatHeroListLoyaltyResidualDeepSubline({
        hero_id: 1,
        loyalty: 80,
        exp_current: 25,
        exp_to_next: 100,
      }),
    ).toContain("忠诚深巩固");
    expect(
      formatHeroListLoyaltyResidualDeepSubline({
        hero_id: 1,
        loyalty: 80,
        exp_current: 25,
        exp_to_next: 100,
      }),
    ).toContain("经验 25/100 · 25%");
    expect(
      formatHeroListLoyaltyResidualDeepSubline({
        hero_id: 1,
        loyalty: 80,
        exp_current: 25,
        exp_to_next: 100,
      }),
    ).toContain("忠诚残余");
  });

  it("marks capped level exp and low loyalty deep warn", () => {
    const ctx = { detailLoyaltyMinByHeroId: new Map([[3, 50]]) };
    const line = formatHeroListLoyaltyResidualDeepSubline(
      { hero_id: 3, loyalty: 45, exp_to_next: 0, exp_current: 999 },
      ctx,
    );
    expect(line).toContain("经验已满");
    expect(line).toContain("低忠诚深警示");
    expect(
      heroListRowShowsLoyaltyResidualDeepWarnDot({ hero_id: 3, loyalty: 45 }, ctx),
    ).toBe(true);
  });
});
