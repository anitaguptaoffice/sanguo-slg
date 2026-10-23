import { describe, expect, it } from "vitest";
import {
  formatRecruitTroopSuccess,
  queueRecruitRowDomId,
  RECRUIT_TROOP_SUBMIT_INFLIGHT_LABEL,
  recruitTroopSubmitButtonDisabled,
  recruitTroopSubmitButtonLabel,
  recruitTroopSubmitStateMachine,
  syncRecruitTroopSubmitButton,
  walletRecruitTroopDeductPulseKeys,
} from "@/net/recruitTroopSubmitFeedback";

describe("recruitTroopSubmitStateMachine", () => {
  it("idle → submitting on SUBMIT", () => {
    expect(recruitTroopSubmitStateMachine("idle", { type: "SUBMIT" })).toBe("submitting");
  });

  it("submitting resolves to idle or error", () => {
    expect(recruitTroopSubmitStateMachine("submitting", { type: "SUCCESS" })).toBe("idle");
    expect(recruitTroopSubmitStateMachine("submitting", { type: "FAIL" })).toBe("error");
    expect(recruitTroopSubmitStateMachine("submitting", { type: "SUBMIT" })).toBe("submitting");
  });

  it("error clears or resubmits", () => {
    expect(recruitTroopSubmitStateMachine("error", { type: "CLEAR_ERROR" })).toBe("idle");
    expect(recruitTroopSubmitStateMachine("error", { type: "SUBMIT" })).toBe("submitting");
    expect(recruitTroopSubmitStateMachine("error", { type: "FAIL" })).toBe("error");
  });
});

describe("recruit troop submit button helpers", () => {
  it("disables while submitting or unaffordable", () => {
    expect(recruitTroopSubmitButtonDisabled("submitting", true)).toBe(true);
    expect(recruitTroopSubmitButtonDisabled("idle", false)).toBe(true);
    expect(recruitTroopSubmitButtonDisabled("idle", true)).toBe(false);
    expect(recruitTroopSubmitButtonLabel("submitting")).toBe(RECRUIT_TROOP_SUBMIT_INFLIGHT_LABEL);
    expect(recruitTroopSubmitButtonLabel("idle")).toBe("募兵");
  });

  it("syncRecruitTroopSubmitButton toggles disabled and label", () => {
    const root = document.createElement("div");
    root.innerHTML = `<button type="button" data-action="recruit">募兵</button>`;
    const btn = root.querySelector("button")!;
    syncRecruitTroopSubmitButton(root, "submitting", true);
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toBe(RECRUIT_TROOP_SUBMIT_INFLIGHT_LABEL);
    syncRecruitTroopSubmitButton(root, "idle", true);
    expect(btn.disabled).toBe(false);
    expect(btn.textContent).toBe("募兵");
  });
});

describe("formatRecruitTroopSuccess", () => {
  it("formats queued and instant outcomes", () => {
    expect(
      formatRecruitTroopSuccess(1, 20, {
        queue_id: 7,
        finish_at_ms: Date.UTC(2024, 0, 1, 12, 0, 0),
      }),
    ).toContain("步兵×20 已排队 #7");
    expect(formatRecruitTroopSuccess(2, 5, { troop: { count: 40 } })).toContain("骑兵");
    expect(formatRecruitTroopSuccess(2, 5, { troop: { count: 40 } })).toContain("40");
  });
});

describe("walletRecruitTroopDeductPulseKeys", () => {
  it("pulses resources that decreased when cost was charged", () => {
    expect(
      walletRecruitTroopDeductPulseKeys(
        { food: 1000, wood: 200 },
        { food: 200, wood: 200 },
        { food: 800, wood: 0, stone: 0, iron: 0 },
      ),
    ).toEqual(["food"]);
  });
});

describe("queueRecruitRowDomId", () => {
  it("is stable per queue id", () => {
    expect(queueRecruitRowDomId(9)).toBe("queue-recruit-row-9");
  });
});
