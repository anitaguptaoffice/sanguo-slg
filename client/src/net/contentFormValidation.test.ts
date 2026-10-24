import { describe, expect, it } from "vitest";
import {
  formatPanelGatewayError,
  formatPanelGatewayErrorFromUnknown,
  setBagFormErrorDisplay,
  setPanelFormErrorDisplay,
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

describe("formatPanelGatewayError", () => {
  it("maps shop insufficient funds with trailing code", () => {
    expect(formatPanelGatewayError("shop", 64003, "余额不足")).toBe("余额不足 [64003]");
  });

  it("maps shop sold out and purchase limit", () => {
    expect(formatPanelGatewayError("shop", 64004, "已售罄")).toBe("已售罄 [64004]");
    expect(formatPanelGatewayError("shop", 64005, "超过限购次数")).toBe("超过限购次数 [64005]");
  });

  it("appends server detail when hint and message differ", () => {
    expect(formatPanelGatewayError("shop", 64004, "sold out")).toBe("已售罄：sold out [64004]");
  });

  it("maps recruit item shortage from common code", () => {
    expect(formatPanelGatewayError("recruit", 10001, "道具不足")).toBe("道具不足 [10001]");
  });

  it("maps march troop and param errors", () => {
    expect(formatPanelGatewayError("march", 50006, "城内兵力不足")).toBe("城内兵力不足 [50006]");
    expect(formatPanelGatewayError("march", 50005, "出征参数无效")).toBe("出征参数无效 [50005]");
  });

  it("maps march hero gateway messages to readable Chinese", () => {
    expect(formatPanelGatewayError("march", 50005, "hero: hero is not idle")).toBe(
      "出征参数无效：将领当前非空闲，无法出征 [50005]",
    );
    expect(formatPanelGatewayError("march", 50005, "hero: insufficient march force")).toBe(
      "出征参数无效：将领出征体力不足 [50005]",
    );
    expect(formatPanelGatewayError("march", 10001, "hero: hero not found")).toBe(
      "将领不存在或不属于您 [10001]",
    );
  });

  it("falls back to server message when code is unknown", () => {
    expect(formatPanelGatewayError("bag", 99999, "自定义错误")).toBe("自定义错误 [99999]");
  });

  it("maps rank/guild/buildQueue list gateway codes", () => {
    expect(formatPanelGatewayError("rank", 62002, "排行榜未开放")).toBe("排行榜未开放 [62002]");
    expect(formatPanelGatewayError("guild", 60007, "军团权限不足")).toBe("军团权限不足 [60007]");
    expect(formatPanelGatewayError("buildQueue", 40004, "建筑等级已满")).toBe(
      "建筑等级已满 [40004]",
    );
  });

  it("formats from Error with code via helper", () => {
    const err = Object.assign(new Error("余额不足"), { code: 64003 });
    expect(formatPanelGatewayErrorFromUnknown("shop", err)).toBe("余额不足 [64003]");
  });
});

describe("content form error display", () => {
  it("routes all panel domains through setPanelFormErrorDisplay", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <p data-role="recruit-form-error" class="hidden"></p>
      <p data-role="march-form-error" class="hidden"></p>
    `;
    setPanelFormErrorDisplay(root, "recruit", "粮食不足");
    setPanelFormErrorDisplay(root, "march", "坐标无效");
    expect(root.querySelector('[data-role="recruit-form-error"]')?.textContent).toBe("粮食不足");
    expect(root.querySelector('[data-role="march-form-error"]')?.textContent).toBe("坐标无效");
  });

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
