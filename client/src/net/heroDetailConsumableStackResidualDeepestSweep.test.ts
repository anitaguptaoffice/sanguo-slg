import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyHeroDetailConsumableStackResidualDeepestSweep,
  formatHeroDetailConsumableStackResidualDeepestSweep,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_RING_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_MS,
  resetHeroDetailConsumableStackResidualDeepestSweepTimersForTests,
} from "@/net/heroDetailConsumableStackResidualDeepestSweep";

describe("formatHeroDetailConsumableStackResidualDeepestSweep (CLIENT-294)", () => {
  const detail = {
    hero_id: 3,
    template_cfg_id: 1001,
    level: 2,
    loyalty: 70,
    loyalty_min: 0,
    loyalty_max: 100,
    exp_current: 10,
    exp_to_next: 100,
  };

  it("includes deeper sweep summary and bag deep-link hint at 2.5s", () => {
    const sweep = formatHeroDetailConsumableStackResidualDeepestSweep(detail, [
      { item_cfg_id: 2017, quantity: 1 },
    ]);
    expect(sweep?.hasDeficit).toBe(true);
    expect(sweep?.text).toContain("堆叠巩固再加深一层");
    expect(sweep?.text).toContain("总缺口");
    expect(sweep?.bagDeepLinkHint).toContain("背包深链");
    expect(sweep?.bagDeepLinkHint).toContain("只读扫读2.5s");
    expect(sweep?.text).toContain("#2017");
  });

  it("applyHeroDetailConsumableStackResidualDeepestSweep adds class for 2.5s", () => {
    const el = document.createElement("p");
    const timeouts: Array<{ fn: () => void; ms: number }> = [];
    const windowObj = {
      setTimeout: (fn: () => void, ms?: number) => {
        timeouts.push({ fn, ms: ms ?? 0 });
        return timeouts.length as ReturnType<typeof setTimeout>;
      },
      clearTimeout: vi.fn(),
    };
    applyHeroDetailConsumableStackResidualDeepestSweep(
      el,
      HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_MS,
      windowObj,
    );
    expect(el.classList.contains(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_RING_CLASS)).toBe(
      true,
    );
    expect(timeouts[0]?.ms).toBe(2500);
    timeouts[0]?.fn?.();
    expect(el.classList.contains(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_RING_CLASS)).toBe(
      false,
    );
  });
});

afterEach(() => {
  resetHeroDetailConsumableStackResidualDeepestSweepTimersForTests();
});
