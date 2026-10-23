import { describe, expect, it, vi } from "vitest";
import {
  QUEST_CLAIM_PULSE_CLASS,
  QUEST_CLAIM_PULSE_MS,
  scheduleQuestClaimRowPulse,
  scrollDailyQuestRowIntoView,
} from "@/net/dailyQuestClaimFeedback";

describe("dailyQuestClaimFeedback", () => {
  it("scrollDailyQuestRowIntoView finds row by quest_cfg_id", () => {
    const panel = document.createElement("div");
    const li = document.createElement("li");
    li.setAttribute("data-quest-cfg-id", "1013");
    panel.appendChild(li);
    const scrolled = vi.fn();
    li.scrollIntoView = scrolled;
    expect(scrollDailyQuestRowIntoView(panel, 1013)).toBe(true);
    expect(scrolled).toHaveBeenCalledWith({ block: "nearest" });
    expect(scrollDailyQuestRowIntoView(panel, 0)).toBe(false);
  });

  it("scheduleQuestClaimRowPulse toggles quest-claim-pulse class", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleQuestClaimRowPulse(row);
    expect(row.classList.contains(QUEST_CLAIM_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(QUEST_CLAIM_PULSE_MS);
    expect(row.classList.contains(QUEST_CLAIM_PULSE_CLASS)).toBe(false);
    vi.useRealTimers();
  });
});
