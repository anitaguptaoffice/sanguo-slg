import { describe, expect, it } from "vitest";
import {
  setBagFormErrorDisplay,
  setShopFormErrorDisplay,
  validatePurchaseShopOffer,
  validateUseConsumable,
} from "@/net/contentFormValidation";

describe("validatePurchaseShopOffer", () => {
  const offer = {
    offer_id: 1001,
    price_resources: { gold: 10 },
    purchase_limit: 3,
    purchased_count: 1,
  };

  it("accepts when wallet and limit allow", () => {
    expect(
      validatePurchaseShopOffer({
        offer,
        offerId: 1001,
        purchaseCount: 1,
        wallet: { gold: 50 },
      }),
    ).toEqual({ ok: true });
  });

  it("rejects insufficient gold without RPC", () => {
    const r = validatePurchaseShopOffer({
      offer,
      offerId: 1001,
      purchaseCount: 1,
      wallet: { gold: 5 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("金币不足");
  });

  it("rejects sold out", () => {
    const r = validatePurchaseShopOffer({
      offer: { ...offer, sold_out: true },
      offerId: 1001,
      purchaseCount: 1,
      wallet: { gold: 100 },
    });
    expect(r).toEqual({ ok: false, message: "该商品已售罄" });
  });

  it("rejects when purchase would exceed limit", () => {
    const r = validatePurchaseShopOffer({
      offer: { ...offer, purchased_count: 3 },
      offerId: 1001,
      purchaseCount: 1,
      wallet: { gold: 100 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("已超过限购次数");
  });
});

describe("validateUseConsumable", () => {
  const bag = [{ item_cfg_id: 2001, quantity: 2 }];

  it("accepts positive count when item is in bag", () => {
    expect(
      validateUseConsumable({ itemCfgId: 2001, count: 1, bag }),
    ).toEqual({ ok: true });
  });

  it("rejects zero count", () => {
    const r = validateUseConsumable({ itemCfgId: 2001, count: 0, bag });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("使用数量须大于 0");
  });

  it("rejects item missing from bag snapshot", () => {
    const r = validateUseConsumable({ itemCfgId: 2003, count: 1, bag });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("背包中没有");
  });
});

describe("content form error display", () => {
  it("shows and clears shop-form-error element", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p class="shop-form-error hidden" data-role="shop-form-error"></p>`;
    const el = root.querySelector('[data-role="shop-form-error"]')!;
    setShopFormErrorDisplay(root, "金币不足");
    expect(el.textContent).toBe("金币不足");
    expect(el.classList.contains("hidden")).toBe(false);
    setShopFormErrorDisplay(root, null);
    expect(el.textContent).toBe("");
    expect(el.classList.contains("hidden")).toBe(true);
  });

  it("shows and clears bag-form-error element", () => {
    const root = document.createElement("div");
    root.innerHTML = `<p class="bag-form-error hidden" data-role="bag-form-error"></p>`;
    const el = root.querySelector('[data-role="bag-form-error"]')!;
    setBagFormErrorDisplay(root, "数量无效");
    expect(el.textContent).toBe("数量无效");
    setBagFormErrorDisplay(root, null);
    expect(el.classList.contains("hidden")).toBe(true);
  });
});
