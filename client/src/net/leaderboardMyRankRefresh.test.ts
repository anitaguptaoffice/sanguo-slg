import { describe, expect, it, vi } from "vitest";
import {
  detectLeaderboardMyRankChange,
  formatMyRankPinSecondaryLine,
  RANK_MY_RANK_CHANGED_PULSE_CLASS,
  scheduleRankMyRankChangedPulse,
} from "@/net/leaderboardMyRankRefresh";

describe("detectLeaderboardMyRankChange", () => {
  it("returns false when there is no previous snapshot", () => {
    expect(detectLeaderboardMyRankChange(undefined, 2)).toBe(false);
  });

  it("returns false when rank is unchanged", () => {
    expect(detectLeaderboardMyRankChange(3, 3)).toBe(false);
    expect(detectLeaderboardMyRankChange(0, 0)).toBe(false);
  });

  it("returns true when rank changes including unranked", () => {
    expect(detectLeaderboardMyRankChange(2, 5)).toBe(true);
    expect(detectLeaderboardMyRankChange(1, 0)).toBe(true);
    expect(detectLeaderboardMyRankChange(0, 4)).toBe(true);
  });
});

describe("formatMyRankPinSecondaryLine", () => {
  it("formats last refresh via social panel stamp", () => {
    const now = 1_700_000_060_000;
    expect(formatMyRankPinSecondaryLine(now - 30_000, now)).toBe("上次刷新：刚刚");
    expect(formatMyRankPinSecondaryLine(0, now)).toBeNull();
  });
});

describe("scheduleRankMyRankChangedPulse", () => {
  it("applies pulse class then removes after 3s", () => {
    vi.useFakeTimers();
    const row = document.createElement("tr");
    scheduleRankMyRankChangedPulse(row);
    expect(row.classList.contains(RANK_MY_RANK_CHANGED_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(row.classList.contains(RANK_MY_RANK_CHANGED_PULSE_CLASS)).toBe(false);
    vi.useRealTimers();
  });
});
