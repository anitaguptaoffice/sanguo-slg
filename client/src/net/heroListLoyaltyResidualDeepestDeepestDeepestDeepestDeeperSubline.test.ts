import { describe, expect, it } from "vitest";
import {
  formatHeroListLoyaltyResidualDeepestDeepestDeepestDeepestDeeperSubline,
  heroListRowShowsLoyaltyResidualDeepestDeepestDeepestDeepestDeeperWarnDot,
} from "@/net/heroListLoyaltyResidualDeepestDeepestDeepestDeepestDeeperSubline";

describe("formatHeroListLoyaltyResidualDeepestDeepestDeepestDeepestDeeperSubline (CLIENT-374)", () => {
  it("includes loyalty exp progress and CLIENT-358 deepest-deepest-deepest-deeper scan", () => {
    const line = formatHeroListLoyaltyResidualDeepestDeepestDeepestDeepestDeeperSubline({
      hero_id: 1,
      loyalty: 80,
      exp_current: 25,
      exp_to_next: 100,
    });
    expect(line).toContain("忠诚巩固再加深五层");
    expect(line).toContain("经验 25/100 · 25%");
    expect(line).toContain("忠诚巩固再加深四层");
  });

  it("marks capped level exp and low loyalty deepest-deepest-deepest-deepest-deeper warn", () => {
    const ctx = { detailLoyaltyMinByHeroId: new Map([[3, 50]]) };
    const line = formatHeroListLoyaltyResidualDeepestDeepestDeepestDeepestDeeperSubline(
      { hero_id: 3, loyalty: 45, exp_to_next: 0, exp_current: 999 },
      ctx,
    );
    expect(line).toContain("经验已满");
    expect(line).toContain("低忠诚再加深五层警示");
    expect(
      heroListRowShowsLoyaltyResidualDeepestDeepestDeepestDeepestDeeperWarnDot(
        { hero_id: 3, loyalty: 45 },
        ctx,
      ),
    ).toBe(true);
  });
});
