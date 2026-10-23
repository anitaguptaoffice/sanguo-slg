import type { BattleReportSummary } from "@/net/militaryFormat";

export type BattleReportListNavDirection = "prev" | "next";

/** 与列表 DOM 相同顺序的 report_id 序列。 */
export function battleReportIdsInListOrder(
  reports: readonly BattleReportSummary[],
): number[] {
  const ids: number[] = [];
  for (const r of reports) {
    const id = r.report_id ?? 0;
    if (id > 0) ids.push(id);
  }
  return ids;
}

/**
 * 在有序 id 列表内移动：prev = 列表上一行（index-1），next = 下一行（index+1）。
 */
export function adjacentBattleReportId(
  orderedIds: readonly number[],
  currentId: number,
  direction: BattleReportListNavDirection,
): number | null {
  if (currentId <= 0 || !orderedIds.length) return null;
  const idx = orderedIds.indexOf(currentId);
  if (idx < 0) return null;
  const nextIdx = direction === "prev" ? idx - 1 : idx + 1;
  if (nextIdx < 0 || nextIdx >= orderedIds.length) return null;
  return orderedIds[nextIdx] ?? null;
}
