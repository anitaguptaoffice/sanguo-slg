import type { BattleReportSummary } from "@/net/militaryFormat";

/** 自上次打开战报面板以来尚未「已读」的 report_id（本会话本地口径）。 */
export class BattleReportUnreadSession {
  private baselineIds = new Set<number>();

  /** 打开战报面板并加载列表后调用：未读清零，当前列表 id 记入基线。 */
  markPanelOpened(reports: BattleReportSummary[]): void {
    this.baselineIds = new Set(reportIdsFromSummaries(reports));
  }

  countUnread(reports: BattleReportSummary[]): number {
    return countUnreadReportIds(reportIdsFromSummaries(reports), this.baselineIds);
  }
}

export function reportIdsFromSummaries(reports: BattleReportSummary[]): number[] {
  const ids: number[] = [];
  for (const r of reports) {
    const id = r.report_id ?? 0;
    if (id > 0) ids.push(id);
  }
  return ids;
}

export function countUnreadReportIds(reportIds: number[], baselineIds: ReadonlySet<number>): number {
  let n = 0;
  for (const id of reportIds) {
    if (id > 0 && !baselineIds.has(id)) n++;
  }
  return n;
}
