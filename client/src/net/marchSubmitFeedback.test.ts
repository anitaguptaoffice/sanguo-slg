import { describe, expect, it } from "vitest";
import {
  formatMarchDepartedStatusToast,
  marchSubmitButtonDisabled,
  marchSubmitButtonLabel,
  marchSubmitStateMachine,
  MARCH_SUBMIT_INFLIGHT_LABEL,
  syncMarchSubmitButton,
} from "@/net/marchSubmitFeedback";

describe("marchSubmitFeedback", () => {
  it("formats departed toast with coords", () => {
    expect(formatMarchDepartedStatusToast(5, 10)).toBe("已出征 (5,10)");
  });

  it("marchSubmitStateMachine covers submit and settle", () => {
    expect(marchSubmitStateMachine("idle", { type: "SUBMIT" })).toBe("submitting");
    expect(marchSubmitStateMachine("submitting", { type: "SETTLE" })).toBe("idle");
    expect(marchSubmitStateMachine("submitting", { type: "SUBMIT" })).toBe("submitting");
  });

  it("marchSubmitButtonDisabled and label follow state", () => {
    expect(marchSubmitButtonDisabled("idle")).toBe(false);
    expect(marchSubmitButtonDisabled("submitting")).toBe(true);
    expect(marchSubmitButtonLabel("submitting")).toBe(MARCH_SUBMIT_INFLIGHT_LABEL);
    expect(marchSubmitButtonLabel("idle")).toBe("出征攻击");
  });

  it("syncMarchSubmitButton toggles disabled and label", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button type="button" data-action="march">出征攻击</button>`;
    const btn = root.querySelector("button")!;
    syncMarchSubmitButton(root, "submitting");
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe(MARCH_SUBMIT_INFLIGHT_LABEL);
    syncMarchSubmitButton(root, "idle");
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("出征攻击");
  });
});
