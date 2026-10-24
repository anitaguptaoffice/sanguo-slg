import { describe, expect, it, vi } from "vitest";
import { MAIL_CLAIM_PULSE_CLASS, scheduleMailClaimRowPulse } from "@/net/mailClaimFeedback";

describe("mailClaimFeedback", () => {
  it("scheduleMailClaimRowPulse toggles mail-claim-pulse class", () => {
    vi.useFakeTimers();
    const li = document.createElement("li");
    scheduleMailClaimRowPulse(li);
    expect(li.classList.contains(MAIL_CLAIM_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(1200);
    expect(li.classList.contains(MAIL_CLAIM_PULSE_CLASS)).toBe(false);
    vi.useRealTimers();
  });
});
