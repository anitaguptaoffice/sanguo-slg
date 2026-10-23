import type { BattleReportSummary } from "@/net/militaryFormat";

export type BattleReportOutcomeStreakKind = "win" | "loss" | "none";

export type BattleReportOutcomeStreak = {
  kind: BattleReportOutcomeStreakKind;
  count: number;
};

/**
 * 从列表首条（最近一场）起统计连续胜(1)或负(2)；平局(3)或其它 outcome 视为无 streak。
 * 入参顺序须与战报列表展示顺序一致（通常为时间倒序）。
 */
export function computeOutcomeStreak(
  reportsInListOrder: readonly BattleReportSummary[],
): BattleReportOutcomeStreak {
  if (!reportsInListOrder.length) return { kind: "none", count: 0 };
  const head = reportsInListOrder[0].outcome ?? 0;
  if (head !== 1 && head !== 2) return { kind: "none", count: 0 };
  const kind: BattleReportOutcomeStreakKind = head === 1 ? "win" : "loss";
  let count = 0;
  for (const r of reportsInListOrder) {
    if ((r.outcome ?? 0) === head) count += 1;
    else break;
  }
  return { kind, count };
}

export function formatBattleReportOutcomeStreakLabel(
  streak: BattleReportOutcomeStreak,
): string | null {
  if (streak.kind === "win" && streak.count > 0) return `连胜 ${streak.count}`;
  if (streak.kind === "loss" && streak.count > 0) return `连负 ${streak.count}`;
  return null;
}
