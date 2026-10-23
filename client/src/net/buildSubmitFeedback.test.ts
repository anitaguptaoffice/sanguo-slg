import { describe, expect, it } from "vitest";
import {
  BUILD_SUBMIT_INFLIGHT_LABEL,
  buildSubmitButtonDisabled,
  buildSubmitButtonLabel,
  buildSubmitStateMachine,
  formatBuildSubmitSuccess,
  syncBuildSubmitButton,
  walletBuildDeductPulseKeys,
} from "@/net/buildSubmitFeedback";

describe("buildSubmitStateMachine", () => {
  it("idle → submitting on SUBMIT", () => {
    expect(buildSubmitStateMachine("idle", { type: "SUBMIT" })).toBe("submitting");
  });

  it("submitting resolves to idle or error", () => {
    expect(buildSubmitStateMachine("submitting", { type: "SUCCESS" })).toBe("idle");
    expect(buildSubmitStateMachine("submitting", { type: "FAIL" })).toBe("error");
    expect(buildSubmitStateMachine("submitting", { type: "SUBMIT" })).toBe("submitting");
  });

  it("error clears or resubmits", () => {
    expect(buildSubmitStateMachine("error", { type: "CLEAR_ERROR" })).toBe("idle");
    expect(buildSubmitStateMachine("error", { type: "SUBMIT" })).toBe("submitting");
    expect(buildSubmitStateMachine("error", { type: "FAIL" })).toBe("error");
  });
});

describe("build submit button helpers", () => {
  it("disables while submitting or upgrading", () => {
    expect(buildSubmitButtonDisabled("submitting", true, false)).toBe(true);
    expect(buildSubmitButtonDisabled("idle", true, true)).toBe(true);
    expect(buildSubmitButtonDisabled("idle", false, false)).toBe(true);
    expect(buildSubmitButtonDisabled("idle", true, false)).toBe(false);
    expect(buildSubmitButtonLabel("submitting")).toBe(BUILD_SUBMIT_INFLIGHT_LABEL);
    expect(buildSubmitButtonLabel("idle")).toBe("确认升级");
  });

  it("syncBuildSubmitButton toggles disabled and label", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button type="button" data-action="confirm-upgrade">确认升级</button>`;
    const btn = root.querySelector("button")!;
    syncBuildSubmitButton(root, "submitting", true, false);
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe(BUILD_SUBMIT_INFLIGHT_LABEL);
    syncBuildSubmitButton(root, "idle", true, false);
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("确认升级");
  });
});

describe("formatBuildSubmitSuccess", () => {
  it("includes slot label and target level", () => {
    expect(formatBuildSubmitSuccess("farm", 2, { farm: "农田" })).toBe("农田 已排队升至 Lv2");
    expect(formatBuildSubmitSuccess("barracks", 3)).toBe("barracks 已排队升至 Lv3");
  });
});

describe("walletBuildDeductPulseKeys", () => {
  it("delegates to material deduct pulse for upgrade cost", () => {
    expect(
      walletBuildDeductPulseKeys(
        { food: 1000, wood: 200 },
        { food: 400, wood: 200 },
        { food: 600, wood: 0, stone: 0, iron: 0 },
      ),
    ).toEqual(["food"]);
  });
});
