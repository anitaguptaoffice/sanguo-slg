import { describe, expect, it, vi } from "vitest";
import { BAG_ROW_INLINE_STATE_CLASS } from "@/net/bagRowInlineState";
import {
  BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS,
  BAG_SHOP_INLINE_STATE_RESIDUAL_RING_MS,
} from "@/net/bagShopInlineStateResidual";
import {
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_CLASS,
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_MS,
  pulseBagShopInlineStateResidualRings,
  scheduleBagShopInlineStateResidualDeepRing,
} from "@/net/bagShopInlineStateResidualDeep";
import {
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPER_RING_CLASS,
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPER_RING_MS,
} from "@/net/bagShopInlineStateResidualDeeperRing";
import { BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_RING_CLASS } from "@/net/bagShopInlineStateResidualDeepestRing";
import { BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPER_RING_CLASS } from "@/net/bagShopInlineStateResidualDeepestDeeperRing";

describe("bagShopInlineStateResidualDeep (CLIENT-272)", () => {
  it("scheduleBagShopInlineStateResidualDeepRing adds class then removes after 2s", () => {
    const el = document.createElement("span");
    const timeouts: Array<{ fn: () => void; ms: number }> = [];
    const windowObj = {
      setTimeout: (fn: () => void, ms?: number) => {
        timeouts.push({ fn, ms: ms ?? 0 });
        return timeouts.length;
      },
      clearTimeout: vi.fn(),
    };
    expect(scheduleBagShopInlineStateResidualDeepRing(el, null, windowObj)).toBe(true);
    expect(el.classList.contains(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_CLASS)).toBe(true);
    expect(timeouts[0]?.ms).toBe(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_MS);
    timeouts[0]?.fn();
    expect(el.classList.contains(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_CLASS)).toBe(false);
  });

  it("pulseBagShopInlineStateResidualRings stacks CLIENT-256 ring through CLIENT-320 deepest-deeper ring", () => {
    const el = document.createElement("span");
    el.className = BAG_ROW_INLINE_STATE_CLASS;
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
    const ringTimeout = timeouts.find((t) => t.ms === BAG_SHOP_INLINE_STATE_RESIDUAL_RING_MS);
    const deepTimeout = timeouts.find((t) => t.ms === BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_MS);
    const deeperTimeout = timeouts.find((t) => t.ms === BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPER_RING_MS);
    expect(ringTimeout).toBeTruthy();
    expect(deepTimeout).toBeTruthy();
    expect(deeperTimeout).toBeTruthy();
  });
});
