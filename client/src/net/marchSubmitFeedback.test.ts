import { describe, expect, it } from "vitest";
import {
  formatMarchDepartedStatusToast,
  MARCH_SUBMIT_INFLIGHT_LABEL,
  syncMarchSubmitButton,
} from "@/net/marchSubmitFeedback";

describe("marchSubmitFeedback", () => {
  it("formats departed toast with coords", () => {
    expect(formatMarchDepartedStatusToast(5, 10)).toBe("已出征 (5,10)");
  });

  it("syncMarchSubmitButton toggles disabled and label", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button type="button" data-action="march">出征攻击</button>`;
    const btn = root.querySelector("button")!;
    syncMarchSubmitButton(root, true);
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe(MARCH_SUBMIT_INFLIGHT_LABEL);
    syncMarchSubmitButton(root, false);
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("出征攻击");
  });
});
