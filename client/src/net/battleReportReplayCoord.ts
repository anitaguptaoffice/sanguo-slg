import type { BattleReportSummary } from "@/net/militaryFormat";

export type BattleReportReplayCoord = {
  wx: number;
  wy: number;
};

/** 从战报 summary 提取战场格点（只读既有 location_x/y，不扩 proto）。 */
export function extractBattleReportReplayCoord(
  summary: BattleReportSummary | undefined | null,
): BattleReportReplayCoord | null {
  if (!summary) return null;
  const wx = summary.location_x;
  const wy = summary.location_y;
  if (wx == null || wy == null || !Number.isFinite(wx) || !Number.isFinite(wy)) {
    return null;
  }
  return { wx, wy };
}

export function formatBattleReportReplayStatusExpanded(coord: BattleReportReplayCoord): string {
  return `战报复盘坐标 (${coord.wx},${coord.wy}) — 小地图已高亮`;
}

export function formatBattleReportReplayStatusCollapsed(coord: BattleReportReplayCoord): string {
  return `战报坐标 (${coord.wx},${coord.wy}) — 展开小地图可查看高亮`;
}
