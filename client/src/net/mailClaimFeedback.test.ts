import { describe, expect, it, vi } from "vitest";
import {
  formatMailClaimSuccessLine,
  MAIL_CLAIM_INLINE_PULSE_CLASS,
  MAIL_CLAIM_PULSE_CLASS,
  scheduleMailClaimInlinePulse,
  scheduleMailClaimRowPulse,
} from "@/net/mailClaimFeedback";

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

  it("scheduleMailClaimInlinePulse toggles mail-claim-inline-pulse class", () => {
    vi.useFakeTimers();
    const p = document.createElement("p");
    scheduleMailClaimInlinePulse(p);
    expect(p.classList.contains(MAIL_CLAIM_INLINE_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(1200);
    expect(p.classList.contains(MAIL_CLAIM_INLINE_PULSE_CLASS)).toBe(false);
    vi.useRealTimers();
  });

  it("formatMailClaimSuccessLine summarizes granted items and resources", () => {
    const line = formatMailClaimSuccessLine({
      items: [{ item_cfg_id: 2001, quantity: 2 }],
      resources: { gold: 50 },
    });
    expect(line).toMatch(/^领取成功：/);
    expect(line).toContain("谷袋");
    expect(line).toContain("×2");
    expect(line).toContain("币");
  });
});
