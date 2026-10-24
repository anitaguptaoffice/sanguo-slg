import { describe, expect, it } from "vitest";
import {
  applyDailyQuestRowAfterClaim,
  dailyBatchClaimSummary,
  orderBatchClaimDailyQuestIds,
  validateBatchClaimDailySelection,
} from "@/net/dailyQuestBatchClaim";

describe("dailyQuestBatchClaim", () => {
  const rows = [
    { quest_cfg_id: 1010, state: 2 },
    { quest_cfg_id: 1012, state: 3, progress_current: 5, progress_target: 5 },
    { quest_cfg_id: 1013, state: 3, progress_current: 1, progress_target: 1 },
    { quest_cfg_id: 1014, state: 4 },
  ];

  it("orders claimable ids in list order", () => {
    expect(orderBatchClaimDailyQuestIds(rows)).toEqual([1012, 1013]);
  });

  it("validates batch selection", () => {
    expect(validateBatchClaimDailySelection(rows).ok).toBe(true);
    expect(validateBatchClaimDailySelection([{ quest_cfg_id: 1, state: 2 }]).ok).toBe(false);
  });

  it("applyDailyQuestRowAfterClaim marks completed", () => {
    const next = applyDailyQuestRowAfterClaim(rows, 1012);
    expect(next.find((q) => q.quest_cfg_id === 1012)?.state).toBe(4);
    expect(next.find((q) => q.quest_cfg_id === 1013)?.state).toBe(3);
  });

  it("dailyBatchClaimSummary aggregates step results", () => {
    const summary = dailyBatchClaimSummary([
      { ok: true },
      { ok: false, message: "[40012] 已领" },
    ]);
    expect(summary.successCount).toBe(1);
    expect(summary.failureCount).toBe(1);
    expect(summary.summaryText).toContain("成功 1 条日常");
    expect(summary.lastError).toContain("40012");
  });
});
