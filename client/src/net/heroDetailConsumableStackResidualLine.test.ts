import { describe, expect, it } from "vitest";
import { formatHeroDetailConsumableStackResidualLine } from "@/net/heroDetailConsumableStackResidualLine";
import type { HeroDetail } from "@/net/heroMailState";

describe("formatHeroDetailConsumableStackResidualLine (CLIENT-246)", () => {
  const detail: HeroDetail = {
    hero_id: 3,
    template_cfg_id: 1001,
    level: 2,
    loyalty: 70,
    loyalty_min: 0,
    loyalty_max: 100,
    exp_current: 10,
    exp_to_next: 100,
  };

  it("aggregates owned vs need and flags deficit", () => {
    const residual = formatHeroDetailConsumableStackResidualLine(detail, [
      { item_cfg_id: 2017, quantity: 1 },
    ]);
    expect(residual?.hasDeficit).toBe(true);
    expect(residual?.text).toContain("持1/需2");
    expect(residual?.text).toContain("总缺口1");
    expect(residual?.text).toContain("对照主行有缺口");
  });

  it("marks sufficient when bag covers combined need", () => {
    const residual = formatHeroDetailConsumableStackResidualLine(detail, [
      { item_cfg_id: 2017, quantity: 5 },
    ]);
    expect(residual?.hasDeficit).toBe(false);
    expect(residual?.text).toContain("充足");
    expect(residual?.text).toContain("对照主行充足");
  });

  it("returns null without hero id", () => {
    expect(formatHeroDetailConsumableStackResidualLine(null, [])).toBeNull();
  });
});
