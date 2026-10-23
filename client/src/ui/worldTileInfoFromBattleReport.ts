import { extractBattleReportReplayCoord } from "@/net/battleReportReplayCoord";
import type { BattleReportSummary } from "@/net/militaryFormat";

/** 战报列表「复盘格点」→ 世界信息卡坐标（CLIENT-109 / CLIENT-108）。 */
export function battleReportWorldTileGrid(
  summary: BattleReportSummary,
): { x: number; y: number } | null {
  const coord = extractBattleReportReplayCoord(summary);
  if (!coord) return null;
  return { x: coord.wx, y: coord.wy };
}

export function battleReportReplayGridLinkLabel(x: number, y: number): string {
  return `复盘格点 (${x},${y})`;
}
