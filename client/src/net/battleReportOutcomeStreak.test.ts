// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  computeOutcomeStreak,
  formatBattleReportOutcomeStreakLabel,
} from "@/net/battleReportOutcomeStreak";

describe("battleReportOutcomeStreak", () => {
  it("counts consecutive wins from newest", () => {
    const reports = [
      { report_id: 3, outcome: 1 },
      { report_id: 2, outcome: 1 },
      { report_id: 1, outcome: 2 },
    ];
    expect(computeOutcomeStreak(reports)).toEqual({ kind: "win", count: 2 });
    expect(formatBattleReportOutcomeStreakLabel({ kind: "win", count: 2 })).toBe("连胜 2");
  });

  it("counts consecutive losses from newest", () => {
    const reports = [
      { report_id: 4, outcome: 2 },
      { report_id: 3, outcome: 2 },
      { report_id: 2, outcome: 1 },
    ];
    expect(computeOutcomeStreak(reports)).toEqual({ kind: "loss", count: 2 });
  });

  it("returns none when latest is draw or unknown", () => {
    expect(computeOutcomeStreak([{ report_id: 1, outcome: 3 }])).toEqual({
      kind: "none",
      count: 0,
    });
    expect(computeOutcomeStreak([{ report_id: 1, outcome: 0 }])).toEqual({
      kind: "none",
      count: 0,
    });
    expect(computeOutcomeStreak([])).toEqual({ kind: "none", count: 0 });
  });

  it("stops at first non-matching outcome", () => {
    const reports = [
      { report_id: 5, outcome: 1 },
      { report_id: 4, outcome: 3 },
      { report_id: 3, outcome: 1 },
    ];
    expect(computeOutcomeStreak(reports)).toEqual({ kind: "win", count: 1 });
  });
});
