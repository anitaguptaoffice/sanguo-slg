import { describe, expect, it, vi } from "vitest";
import {
  DAILY_QUEST_CLAIM_PULSE_CLASS,
  QUEST_CLAIM_PROGRESS_PULSE_CLASS,
  QUEST_CLAIM_PROGRESS_PULSE_MS,
  QUEST_CLAIM_PULSE_CLASS,
  QUEST_CLAIM_PULSE_MS,
  pickQuestCfgIdForClaimableScroll,
  scheduleQuestClaimProgressPulse,
  scheduleQuestClaimRowPulse,
  scrollDailyQuestRowIntoView,
  scrollQuestClaimableIntoView,
} from "@/net/dailyQuestClaimFeedback";
import type { DailyQuestRow } from "@/net/dailyQuestState";

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

  it("pickQuestCfgIdForClaimableScroll respects claimable filter order (CLIENT-091)", () => {
    const rows: DailyQuestRow[] = [
      { quest_cfg_id: 1010, state: 3 },
      { quest_cfg_id: 1012, state: 3 },
      { quest_cfg_id: 1013, state: 2 },
    ];
    expect(pickQuestCfgIdForClaimableScroll(rows, "all")).toBe(1010);
    expect(pickQuestCfgIdForClaimableScroll(rows, "claimable")).toBe(1010);
  });

  it("scrollQuestClaimableIntoView scrolls first claimable row (CLIENT-233)", () => {
    const panel = document.createElement("div");
    const li = document.createElement("li");
    li.setAttribute("data-quest-cfg-id", "1012");
    panel.appendChild(li);
    const scrolled = vi.fn();
    li.scrollIntoView = scrolled;
    const rows: DailyQuestRow[] = [{ quest_cfg_id: 1012, state: 3 }];
    expect(scrollQuestClaimableIntoView(panel, rows, "all")).toBe(true);
    expect(scrolled).toHaveBeenCalledWith({ block: "nearest" });
    expect(scrollQuestClaimableIntoView(panel, [], "all")).toBe(false);
  });

  it("scheduleQuestClaimProgressPulse toggles quest-claim-progress-pulse class", () => {
    vi.useFakeTimers();
    const el = document.createElement("span");
    scheduleQuestClaimProgressPulse(el);
    expect(el.classList.contains(QUEST_CLAIM_PROGRESS_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(QUEST_CLAIM_PROGRESS_PULSE_MS);
    expect(el.classList.contains(QUEST_CLAIM_PROGRESS_PULSE_CLASS)).toBe(false);
    vi.useRealTimers();
  });

  it("scheduleQuestClaimRowPulse toggles quest-claim-pulse class", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleQuestClaimRowPulse(row);
    expect(row.classList.contains(QUEST_CLAIM_PULSE_CLASS)).toBe(true);
    expect(row.classList.contains(DAILY_QUEST_CLAIM_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(QUEST_CLAIM_PULSE_MS);
    expect(row.classList.contains(QUEST_CLAIM_PULSE_CLASS)).toBe(false);
    expect(row.classList.contains(DAILY_QUEST_CLAIM_PULSE_CLASS)).toBe(false);
    vi.useRealTimers();
  });
});
