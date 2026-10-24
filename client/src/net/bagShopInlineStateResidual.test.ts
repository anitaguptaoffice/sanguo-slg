import { describe, expect, it, vi } from "vitest";
import { BAG_ROW_INLINE_STATE_CLASS } from "@/net/bagRowInlineState";
import {
  BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS,
  BAG_SHOP_INLINE_STATE_RESIDUAL_RING_MS,
  findBagShopInlineStateResidualTarget,
  isBagStackAtCap,
  isShopOfferWalletInsufficient,
  scheduleBagShopInlineStateResidualRing,
  shouldBagShopInlineStateResidualRing,
} from "@/net/bagShopInlineStateResidual";
import { SHOP_OFFER_AFFORD_INLINE_CLASS } from "@/engine/mainCityWave30NarrowManifest";

describe("bagShopInlineStateResidual (CLIENT-256)", () => {
  it("detects bag stack at local cap", () => {
    expect(isBagStackAtCap({ item_cfg_id: 2001, quantity: 99 })).toBe(true);
    expect(isBagStackAtCap({ item_cfg_id: 2001, quantity: 98 })).toBe(false);
  });

  it("detects shop wallet insufficient", () => {
    const offer = {
      offer_id: 1001,
      price_resources: { gold: 100 },
      sold_out: false,
    };
    expect(isShopOfferWalletInsufficient({ gold: 5 }, offer)).toBe(true);
    expect(isShopOfferWalletInsufficient({ gold: 200 }, offer)).toBe(false);
  });

  it("shouldBagShopInlineStateResidualRing gates on panel context", () => {
    expect(
      shouldBagShopInlineStateResidualRing(
        "bag",
        { item_cfg_id: 2001, quantity: 99 },
        undefined,
        null,
      ),
    ).toBe(true);
    expect(
      shouldBagShopInlineStateResidualRing(
        "shop",
        null,
        { gold: 1 },
        { offer_id: 1, price_resources: { gold: 50 }, sold_out: false },
      ),
    ).toBe(true);
  });

  it("findBagShopInlineStateResidualTarget prefers inline afford nodes on shop rows", () => {
    const li = document.createElement("li");
    const afford = document.createElement("span");
    afford.className = SHOP_OFFER_AFFORD_INLINE_CLASS;
    li.appendChild(afford);
    expect(findBagShopInlineStateResidualTarget(li, "shop")).toBe(afford);

    const bagLi = document.createElement("li");
    const inline = document.createElement("span");
    inline.className = BAG_ROW_INLINE_STATE_CLASS;
    bagLi.appendChild(inline);
    expect(findBagShopInlineStateResidualTarget(bagLi, "bag")).toBe(inline);
  });

  it("scheduleBagShopInlineStateResidualRing adds class then removes after duration", () => {
    const el = document.createElement("span");
    const timeouts: Array<{ fn: () => void; ms: number }> = [];
    const windowObj = {
      setTimeout: (fn: () => void, ms?: number) => {
        timeouts.push({ fn, ms: ms ?? 0 });
        return timeouts.length;
      },
      clearTimeout: vi.fn(),
    };
    expect(scheduleBagShopInlineStateResidualRing(el, null, windowObj)).toBe(true);
    expect(el.classList.contains(BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS)).toBe(true);
    expect(timeouts[0]?.ms).toBe(BAG_SHOP_INLINE_STATE_RESIDUAL_RING_MS);
    timeouts[0]?.fn();
    expect(el.classList.contains(BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS)).toBe(false);
  });
});
