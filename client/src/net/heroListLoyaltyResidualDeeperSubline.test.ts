import { describe, expect, it } from "vitest";
import {
  formatHeroListLoyaltyResidualDeeperSubline,
  heroListRowShowsLoyaltyResidualDeeperWarnDot,
} from "@/net/heroListLoyaltyResidualDeeperSubline";

describe("formatHeroListLoyaltyResidualDeeperSubline (CLIENT-278)", () => {
  it("includes loyalty exp progress and CLIENT-262 deep scan", () => {
    const line = formatHeroListLoyaltyResidualDeeperSubline({
      hero_id: 1,
      loyalty: 80,
      exp_current: 25,
      exp_to_next: 100,
    });
    expect(line).toContain("忠诚巩固再加深");
    expect(line).toContain("经验 25/100 · 25%");
    expect(line).toContain("忠诚深巩固");
  });

  it("marks capped level exp and low loyalty deeper warn", () => {
    const ctx = { detailLoyaltyMinByHeroId: new Map([[3, 50]]) };
    const line = formatHeroListLoyaltyResidualDeeperSubline(
      { hero_id: 3, loyalty: 45, exp_to_next: 0, exp_current: 999 },
      ctx,
    );
    expect(line).toContain("经验已满");
    expect(line).toContain("低忠诚再加深警示");
    expect(
      heroListRowShowsLoyaltyResidualDeeperWarnDot({ hero_id: 3, loyalty: 45 }, ctx),
    ).toBe(true);
  });
});
