import { describe, expect, it } from "vitest";
import { formatHeroDetailConsumableStackLine } from "@/net/heroDetailConsumableStackLine";
import type { HeroDetail } from "@/net/heroMailState";

describe("formatHeroDetailConsumableStackLine (CLIENT-213)", () => {
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

  it("shows bag stack count with level and loyalty need and shortfall", () => {
    const line = formatHeroDetailConsumableStackLine(detail, [{ item_cfg_id: 2017, quantity: 1 }]);
    expect(line).toContain("堆叠×1");
    expect(line).toContain("升级需1");
    expect(line).toContain("忠诚需1");
    expect(line).toContain("缺口1");
  });

  it("marks sufficient when bag covers combined need", () => {
    const line = formatHeroDetailConsumableStackLine(detail, [{ item_cfg_id: 2017, quantity: 5 }]);
    expect(line).toContain("堆叠×5");
    expect(line).toContain("充足");
    expect(line).not.toContain("缺口");
  });

  it("returns null without hero id", () => {
    expect(formatHeroDetailConsumableStackLine(null, [])).toBeNull();
  });
});
