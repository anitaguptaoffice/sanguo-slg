import { describe, expect, it } from "vitest";
import {
  formatShopPurchaseSuccess,
  purchaseSubmitButtonDisabled,
  purchaseSubmitButtonLabel,
  purchaseSubmitStateMachine,
  SHOP_PURCHASE_SUBMIT_INFLIGHT_LABEL,
  syncShopPurchaseSubmitButton,
  walletShopPurchaseDeductPulseKeys,
} from "@/net/purchaseSubmitFeedback";

describe("purchaseSubmitStateMachine", () => {
  it("idle → submitting on SUBMIT", () => {
    expect(purchaseSubmitStateMachine("idle", { type: "SUBMIT" })).toBe("submitting");
  });

  it("submitting resolves to idle or error", () => {
    expect(purchaseSubmitStateMachine("submitting", { type: "SUCCESS" })).toBe("idle");
    expect(purchaseSubmitStateMachine("submitting", { type: "FAIL" })).toBe("error");
    expect(purchaseSubmitStateMachine("submitting", { type: "SUBMIT" })).toBe("submitting");
  });

  it("error clears or resubmits", () => {
    expect(purchaseSubmitStateMachine("error", { type: "CLEAR_ERROR" })).toBe("idle");
    expect(purchaseSubmitStateMachine("error", { type: "SUBMIT" })).toBe("submitting");
    expect(purchaseSubmitStateMachine("error", { type: "FAIL" })).toBe("error");
  });
});

describe("shop purchase submit button helpers", () => {
  it("disables while submitting or when cannot purchase", () => {
    expect(purchaseSubmitButtonDisabled("submitting", true)).toBe(true);
    expect(purchaseSubmitButtonDisabled("idle", false)).toBe(true);
    expect(purchaseSubmitButtonDisabled("idle", true)).toBe(false);
    expect(purchaseSubmitButtonLabel("submitting")).toBe(SHOP_PURCHASE_SUBMIT_INFLIGHT_LABEL);
    expect(purchaseSubmitButtonLabel("idle")).toBe("购买×1");
  });

  it("syncShopPurchaseSubmitButton toggles disabled and label", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button type="button" data-action="buy-offer">购买×1</button>`;
    const btn = root.querySelector("button")!;
    syncShopPurchaseSubmitButton(root, "submitting", true);
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe(SHOP_PURCHASE_SUBMIT_INFLIGHT_LABEL);
    syncShopPurchaseSubmitButton(root, "idle", true);
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("购买×1");
  });
});

describe("formatShopPurchaseSuccess", () => {
  it("includes offer cfg id", () => {
    expect(formatShopPurchaseSuccess(1001)).toBe("商品 #1001 购买成功");
    expect(formatShopPurchaseSuccess(0)).toBe("购买成功");
  });
});

describe("walletShopPurchaseDeductPulseKeys", () => {
  it("pulses material keys when wallet drops for scaled price", () => {
    expect(
      walletShopPurchaseDeductPulseKeys(
        { food: 1000, gold: 50 },
        { food: 200, gold: 40 },
        { food: 400, gold: 10 },
        2,
      ),
    ).toEqual(["food"]);
    expect(
      walletShopPurchaseDeductPulseKeys({ food: 100 }, { food: 100 }, { food: 50 }, 1),
    ).toEqual([]);
  });
});
