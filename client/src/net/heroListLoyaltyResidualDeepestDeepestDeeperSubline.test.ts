import { describe, expect, it } from "vitest";
import {
  formatHeroListLoyaltyResidualDeepestDeepestDeeperSubline,
  heroListRowShowsLoyaltyResidualDeepestDeepestDeeperWarnDot,
} from "@/net/heroListLoyaltyResidualDeepestDeepestDeeperSubline";

describe("formatHeroListLoyaltyResidualDeepestDeepestDeeperSubline (CLIENT-326)", () => {
  it("includes loyalty exp progress and CLIENT-310 deepest-deeper scan", () => {
    const line = formatHeroListLoyaltyResidualDeepestDeepestDeeperSubline({
      hero_id: 1,
      loyalty: 80,
      exp_current: 25,
      exp_to_next: 100,
    });
    expect(line).toContain("忠诚巩固再加深三层");
    expect(line).toContain("经验 25/100 · 25%");
    expect(line).toContain("忠诚巩固再加深二层");
  });

  it("marks capped level exp and low loyalty deepest-deepest-deeper warn", () => {
    const ctx = { detailLoyaltyMinByHeroId: new Map([[3, 50]]) };
    const line = formatHeroListLoyaltyResidualDeepestDeepestDeeperSubline(
      { hero_id: 3, loyalty: 45, exp_to_next: 0, exp_current: 999 },
      ctx,
    );
    expect(line).toContain("经验已满");
    expect(line).toContain("低忠诚再加深三层警示");
    expect(
      heroListRowShowsLoyaltyResidualDeepestDeepestDeeperWarnDot({ hero_id: 3, loyalty: 45 }, ctx),
    ).toBe(true);
  });
});
