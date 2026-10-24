import { describe, expect, it } from "vitest";
import { formatDailyClaimableSweepLine } from "@/net/dailyClaimableSweep";

describe("formatDailyClaimableSweepLine (CLIENT-193)", () => {
  it("returns null when no claimable daily", () => {
    expect(formatDailyClaimableSweepLine([])).toBeNull();
    expect(
      formatDailyClaimableSweepLine([
        { quest_cfg_id: 1, state: 1 },
        { quest_cfg_id: 2, state: 2, progress_current: 1, progress_target: 10 },
      ]),
    ).toBeNull();
  });

  it("surfaces claimable count and first quest progress percent", () => {
    expect(
      formatDailyClaimableSweepLine([
        { quest_cfg_id: 1010, state: 3, progress_current: 50, progress_target: 100 },
        { quest_cfg_id: 1012, state: 3, progress_current: 5000, progress_target: 5000 },
      ]),
    ).toBe("可领 2 · #1010 进度 50%");
  });

  it("omits percent when progress_target is zero", () => {
    expect(formatDailyClaimableSweepLine([{ quest_cfg_id: 88, state: 3, progress_target: 0 }])).toBe(
      "可领 1 · #88",
    );
  });
});
