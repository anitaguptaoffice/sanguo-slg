import { describe, expect, it } from "vitest";
import {
  BAG_ROW_USED_PULSE_CLASS,
  BAG_USE_CONSUMABLE_PULSE_CLASS,
  BAG_USE_INLINE_PULSE_CLASS,
  countBagStackAfterUse,
  formatBagUseEconomyErrorLine,
  formatBagUseGatewayErrorFromUnknown,
  scheduleBagRowUsedPulse,
  scheduleBagUseConsumablePulse,
  scheduleBagUseInlinePulse,
  shouldPulseBagStackAfterUse,
  USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL,
  useConsumableSubmitButtonLabel,
  useConsumableSubmitButtonsDisabled,
  useConsumableSubmitStateMachine,
  walletUseConsumablePulseKeys,
} from "@/net/useConsumableSubmitFeedback";

describe("useConsumableSubmitStateMachine", () => {
  it("idle → submitting on SUBMIT", () => {
    expect(useConsumableSubmitStateMachine("idle", { type: "SUBMIT" })).toBe("submitting");
  });

  it("submitting resolves to idle or error", () => {
    expect(useConsumableSubmitStateMachine("submitting", { type: "SUCCESS" })).toBe("idle");
    expect(useConsumableSubmitStateMachine("submitting", { type: "FAIL" })).toBe("error");
    expect(useConsumableSubmitStateMachine("submitting", { type: "SUBMIT" })).toBe("submitting");
  });

  it("error clears or resubmits", () => {
    expect(useConsumableSubmitStateMachine("error", { type: "CLEAR_ERROR" })).toBe("idle");
    expect(useConsumableSubmitStateMachine("error", { type: "SUBMIT" })).toBe("submitting");
    expect(useConsumableSubmitStateMachine("error", { type: "FAIL" })).toBe("error");
  });
});

describe("countBagStackAfterUse", () => {
  const bag = [
    { item_cfg_id: 2001, quantity: 5 },
    { item_cfg_id: 2003, quantity: 2 },
  ];

  it("returns server remaining when stack persists", () => {
    expect(countBagStackAfterUse(bag, 2001, 4)).toBe(4);
  });

  it("returns 0 when stack depleted", () => {
    expect(countBagStackAfterUse(bag, 2001, 0)).toBe(0);
    expect(countBagStackAfterUse(bag, 2003, 0)).toBe(0);
  });

  it("handles unknown item with positive remaining", () => {
    expect(countBagStackAfterUse(bag, 2020, 1)).toBe(1);
  });
});

describe("use consumable submit button helpers", () => {
  it("disables while submitting and shows inflight label", () => {
    expect(useConsumableSubmitButtonsDisabled("submitting")).toBe(true);
    expect(useConsumableSubmitButtonsDisabled("idle")).toBe(false);
    expect(useConsumableSubmitButtonLabel("submitting", "use-item")).toBe(
      USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL,
    );
    expect(useConsumableSubmitButtonLabel("idle", "use-item-batch")).toBe("批量使用勾选格");
  });
});

describe("scheduleBagRowUsedPulse", () => {
  it("toggles bag-row-used-pulse class", () => {
    const row = document.createElement("li");
    scheduleBagRowUsedPulse(row);
    expect(row.classList.contains(BAG_ROW_USED_PULSE_CLASS)).toBe(true);
  });
});

describe("scheduleBagUseInlinePulse (CLIENT-194)", () => {
  it("pulses bag-row-inline-state without replacing row pulse", () => {
    const row = document.createElement("li");
    const inline = document.createElement("span");
    inline.className = "bag-row-inline-state";
    row.appendChild(inline);
    scheduleBagUseInlinePulse(row);
    expect(row.classList.contains(BAG_ROW_USED_PULSE_CLASS)).toBe(false);
    expect(inline.classList.contains(BAG_USE_INLINE_PULSE_CLASS)).toBe(true);
  });
});

describe("scheduleBagUseConsumablePulse (CLIENT-232)", () => {
  it("pulses bag-stack-qty with bag-use-consumable-pulse", () => {
    const row = document.createElement("li");
    const qty = document.createElement("span");
    qty.className = "bag-stack-qty";
    qty.textContent = "×2";
    row.appendChild(qty);
    scheduleBagUseConsumablePulse(row);
    expect(qty.classList.contains(BAG_USE_CONSUMABLE_PULSE_CLASS)).toBe(true);
    expect(row.classList.contains(BAG_ROW_USED_PULSE_CLASS)).toBe(false);
  });
});

describe("formatBagUseEconomyErrorLine (CLIENT-232)", () => {
  it("maps item insufficient to CLIENT-067 recruit-style line", () => {
    const err = Object.assign(new Error("道具不足"), { code: 10001 });
    expect(formatBagUseEconomyErrorLine(err)).toBe("道具不足 [10001]");
  });

  it("maps resource insufficient to bag domain CLIENT-067 line", () => {
    const err = Object.assign(new Error("资源不足"), { code: 40001 });
    expect(formatBagUseEconomyErrorLine(err)).toBe("资源不足 [40001]");
  });

  it("returns null for non-economy bag errors", () => {
    const err = Object.assign(new Error("unknown item"), { code: 10001 });
    expect(formatBagUseEconomyErrorLine(err)).toBeNull();
    expect(formatBagUseGatewayErrorFromUnknown(err)).toBe("请求无效：unknown item [10001]");
  });
});

describe("shouldPulseBagStackAfterUse", () => {
  it("pulses when quantity changes", () => {
    expect(shouldPulseBagStackAfterUse(3, 2)).toBe(true);
    expect(shouldPulseBagStackAfterUse(2, 2)).toBe(false);
  });
});

describe("walletUseConsumablePulseKeys", () => {
  it("delegates wallet increases to CLIENT-051 helper", () => {
    expect(walletUseConsumablePulseKeys({ food: 10 }, { food: 100 })).toEqual(["food"]);
  });
});
