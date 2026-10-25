import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyHeroDetailConsumableStackResidualDeepestDeeperSweep,
  formatHeroDetailConsumableStackResidualDeepestDeeperSweep,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPER_SWEEP_RING_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPER_SWEEP_MS,
  resetHeroDetailConsumableStackResidualDeepestDeeperSweepTimersForTests,
} from "@/net/heroDetailConsumableStackResidualDeepestDeeperSweep";

describe("formatHeroDetailConsumableStackResidualDeepestDeeperSweep (CLIENT-310)", () => {
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

  it("includes deepest sweep summary and bag deep-link hint at 3s", () => {
    const sweep = formatHeroDetailConsumableStackResidualDeepestDeeperSweep(detail, [
      { item_cfg_id: 2017, quantity: 1 },
    ]);
    expect(sweep?.hasDeficit).toBe(true);
    expect(sweep?.text).toContain("堆叠巩固再加深二层");
    expect(sweep?.text).toContain("总缺口");
    expect(sweep?.bagDeepLinkHint).toContain("背包深链");
    expect(sweep?.bagDeepLinkHint).toContain("只读扫读3s");
    expect(sweep?.text).toContain("#2017");
  });

  it("applyHeroDetailConsumableStackResidualDeepestDeeperSweep adds class for 3s", () => {
    const el = document.createElement("p");
    const timeouts: Array<{ fn: () => void; ms: number }> = [];
    const windowObj = {
      setTimeout: (fn: () => void, ms?: number) => {
        timeouts.push({ fn, ms: ms ?? 0 });
        return timeouts.length as ReturnType<typeof setTimeout>;
      },
      clearTimeout: vi.fn(),
    };
    applyHeroDetailConsumableStackResidualDeepestDeeperSweep(
      el,
      HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPER_SWEEP_MS,
      windowObj,
    );
    expect(
      el.classList.contains(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPER_SWEEP_RING_CLASS),
    ).toBe(true);
    expect(timeouts[0]?.ms).toBe(3000);
    timeouts[0]?.fn?.();
    expect(
      el.classList.contains(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPER_SWEEP_RING_CLASS),
    ).toBe(false);
  });
});

afterEach(() => {
  resetHeroDetailConsumableStackResidualDeepestDeeperSweepTimersForTests();
});
