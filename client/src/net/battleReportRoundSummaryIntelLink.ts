import { resolveIntelRowNearCoords } from "@/net/battleReportIntelReplayJump";
import type { BattleReportSummary, MarchSummary } from "@/net/militaryFormat";

export const REPORT_ROUND_SUMMARY_INTEL_LINK_CLASS = "report-round-summary-intel-link";
export const OPEN_INTEL_FOR_REPORT_ACTION = "open-intel-for-report";

function marchRecencyKey(m: MarchSummary): number {
  const arrive = m.arrive_at_ms ?? 0;
  const depart = m.depart_at_ms ?? 0;
  const id = m.march_id ?? 0;
  return Math.max(arrive, depart, id);
}

function pickLatestMarch(candidates: MarchSummary[]): MarchSummary | null {
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => marchRecencyKey(b) - marchRecencyKey(a))[0] ?? null;
}

/**
 * 战报详情回合摘要条 → 军情只读选中：同源 report_id 行军优先，否则战报坐标最近目的格行军。
 */
export function resolveMarchIdForBattleReport(
  marches: MarchSummary[],
  summary: BattleReportSummary,
): number | null {
  const reportId = summary.report_id;
  if (reportId != null && reportId > 0) {
    const linked = marches.filter((m) => m.report_id === reportId);
    const pick = pickLatestMarch(linked);
    if (pick?.march_id != null && pick.march_id > 0) {
      return Math.trunc(pick.march_id);
    }
  }

  const wx = summary.location_x;
  const wy = summary.location_y;
  if (wx == null || wy == null || !Number.isFinite(wx) || !Number.isFinite(wy)) {
    return null;
  }

  const near = resolveIntelRowNearCoords(marches, wx, wy);
  return near?.marchId != null && near.marchId > 0 ? near.marchId : null;
}

export function canOfferRoundSummaryIntelLink(
  marches: MarchSummary[],
  summary: BattleReportSummary | undefined | null,
): boolean {
  if (!summary) return false;
  return resolveMarchIdForBattleReport(marches, summary) != null;
}
