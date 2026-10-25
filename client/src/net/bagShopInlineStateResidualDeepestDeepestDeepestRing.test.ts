import { describe, expect, it, vi } from "vitest";
import {
  BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS,
  BAG_SHOP_INLINE_STATE_RESIDUAL_RING_MS,
} from "@/net/bagShopInlineStateResidual";
import {
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_CLASS,
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_MS,
  pulseBagShopInlineStateResidualRings,
} from "@/net/bagShopInlineStateResidualDeep";
import {
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPER_RING_CLASS,
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPER_RING_MS,
} from "@/net/bagShopInlineStateResidualDeeperRing";
import {
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_RING_CLASS,
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_RING_MS,
} from "@/net/bagShopInlineStateResidualDeepestRing";
import {
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPER_RING_CLASS,
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPER_RING_MS,
} from "@/net/bagShopInlineStateResidualDeepestDeeperRing";
import {
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_MS,
} from "@/net/bagShopInlineStateResidualDeepestDeepestDeeperRing";
import {
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS,
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_MS,
  scheduleBagShopInlineStateResidualDeepestDeepestDeepestRing,
} from "@/net/bagShopInlineStateResidualDeepestDeepestDeepestRing";
import {
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS,
} from "@/net/bagShopInlineStateResidualDeepestDeepestDeepestDeeperRing";

describe("bagShopInlineStateResidualDeepestDeepestDeepestRing (CLIENT-352)", () => {
  it("scheduleBagShopInlineStateResidualDeepestDeepestDeepestRing adds class then removes after 2s", () => {
    const el = document.createElement("span");
    const timeouts: Array<{ fn: () => void; ms: number }> = [];
    const windowObj = {
      setTimeout: (fn: () => void, ms?: number) => {
        timeouts.push({ fn, ms: ms ?? 0 });
        return timeouts.length;
      },
      clearTimeout: vi.fn(),
    };
    expect(
      scheduleBagShopInlineStateResidualDeepestDeepestDeepestRing(el, null, windowObj),
    ).toBe(true);
    expect(
      el.classList.contains(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS),
    ).toBe(true);
    expect(timeouts[0]?.ms).toBe(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_MS);
    timeouts[0]?.fn();
    expect(
      el.classList.contains(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS),
    ).toBe(false);
  });

  it("pulseBagShopInlineStateResidualRings stacks CLIENT-256 through CLIENT-368 rings", () => {
    const el = document.createElement("span");
    const timeouts: Array<{ fn: () => void; ms: number }> = [];
    const windowObj = {
      setTimeout: (fn: () => void, ms?: number) => {
        timeouts.push({ fn, ms: ms ?? 0 });
        return timeouts.length;
      },
      clearTimeout: vi.fn(),
    };
    expect(pulseBagShopInlineStateResidualRings(el, null, windowObj)).toBe(true);
    expect(el.classList.contains(BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS)).toBe(true);
    expect(el.classList.contains(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_CLASS)).toBe(true);
    expect(el.classList.contains(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPER_RING_CLASS)).toBe(true);
    expect(el.classList.contains(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_RING_CLASS)).toBe(true);
    expect(el.classList.contains(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPER_RING_CLASS)).toBe(
      true,
    );
    expect(
      el.classList.contains(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS),
    ).toBe(true);
    expect(
      el.classList.contains(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS),
    ).toBe(true);
    expect(
      el.classList.contains(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS),
    ).toBe(true);
    expect(timeouts.some((t) => t.ms === BAG_SHOP_INLINE_STATE_RESIDUAL_RING_MS)).toBe(true);
    expect(timeouts.some((t) => t.ms === BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_MS)).toBe(true);
    expect(timeouts.some((t) => t.ms === BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPER_RING_MS)).toBe(true);
    expect(timeouts.some((t) => t.ms === BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_RING_MS)).toBe(
      true,
    );
    expect(
      timeouts.some((t) => t.ms === BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPER_RING_MS),
    ).toBe(true);
    expect(
      timeouts.some((t) => t.ms === BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_MS),
    ).toBe(true);
    expect(
      timeouts.some((t) => t.ms === BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_MS),
    ).toBe(true);
    expect(
      timeouts.some(
        (t) => t.ms === BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS,
      ),
    ).toBe(true);
  });
});
