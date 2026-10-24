import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyHeroDetailConsumableStackResidualDeepSweep,
  formatHeroDetailConsumableStackResidualDeepSweep,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_RING_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_MS,
  resetHeroDetailConsumableStackResidualDeepSweepTimersForTests,
} from "@/net/heroDetailConsumableStackResidualDeepSweep";

describe("formatHeroDetailConsumableStackResidualDeepSweep (CLIENT-262)", () => {
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

  it("includes residual stack summary and bag deep-link hint", () => {
    const sweep = formatHeroDetailConsumableStackResidualDeepSweep(detail, [
      { item_cfg_id: 2017, quantity: 1 },
    ]);
    expect(sweep?.hasDeficit).toBe(true);
    expect(sweep?.text).toContain("堆叠深扫读");
    expect(sweep?.bagDeepLinkHint).toContain("背包深链");
    expect(sweep?.bagDeepLinkHint).toContain("只读扫读2s");
    expect(sweep?.text).toContain("#2017");
  });

  it("applyHeroDetailConsumableStackResidualDeepSweep adds class for 2s", () => {
    const el = document.createElement("p");
    const timeouts: Array<{ fn: () => void; ms: number }> = [];
    const windowObj = {
      setTimeout: (fn: () => void, ms?: number) => {
        timeouts.push({ fn, ms: ms ?? 0 });
        return timeouts.length as ReturnType<typeof setTimeout>;
      },
      clearTimeout: vi.fn(),
    };
    applyHeroDetailConsumableStackResidualDeepSweep(el, HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_MS, windowObj);
    expect(el.classList.contains(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_RING_CLASS)).toBe(true);
    expect(timeouts[0]?.ms).toBe(2000);
    timeouts[0]?.fn?.();
    expect(el.classList.contains(HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_RING_CLASS)).toBe(false);
  });
});

afterEach(() => {
  resetHeroDetailConsumableStackResidualDeepSweepTimersForTests();
});
