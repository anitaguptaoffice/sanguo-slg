import type { BattleReportSummary } from "@/net/militaryFormat";

/** 行军结束 HUD 提示点击时优先选中的战报 ID（由到达回调或列表刷新写入）。 */
export class MarchEndBattleReportHint {
  private hintReportId: number | null = null;

  setFromReports(reports: BattleReportSummary[]): void {
    const id = pickLatestBattleReportId(reports);
    if (id > 0) this.hintReportId = id;
  }

  setReportId(reportId: number | undefined | null): void {
    const id = reportId ?? 0;
    if (id > 0) this.hintReportId = id;
  }

  peek(): number | null {
    return this.hintReportId;
  }

  consume(): number | null {
    const id = this.hintReportId;
    this.hintReportId = null;
    return id;
  }
}

/** 列表按时间倒序时首条即最近战报；否则取最大 report_id。 */
export function pickLatestBattleReportId(reports: BattleReportSummary[]): number {
  if (!reports.length) return 0;
  let maxId = 0;
  for (const r of reports) {
    const id = r.report_id ?? 0;
    if (id > maxId) maxId = id;
  }
  if (maxId > 0) return maxId;
  return reports[0]?.report_id ?? 0;
}

/**
 * 深链打开战报详情：优先 hint（且在已加载列表中），否则最近一条。
 */
export function selectDeepLinkBattleReportId(
  reports: BattleReportSummary[],
  hintReportId?: number | null,
): number {
  const hint = hintReportId ?? 0;
  if (hint > 0 && reports.some((r) => (r.report_id ?? 0) === hint)) {
    return hint;
  }
  return pickLatestBattleReportId(reports);
}
