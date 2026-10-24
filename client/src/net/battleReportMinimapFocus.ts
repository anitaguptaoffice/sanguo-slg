import {
  extractBattleReportReplayCoord,
  formatBattleReportReplayStatusExpanded,
  type BattleReportReplayCoord,
} from "@/net/battleReportReplayCoord";
import type { BattleReportSummary } from "@/net/militaryFormat";
import {
  computeMinimapViewFramingPoints,
  type MinimapView,
  type MinimapWorldBounds,
} from "@/ui/worldMinimap";

/** 战报战场格点（与世界格点、summary `location_x/y` 对齐）。 */
export type BattleReportLocation = {
  x: number;
  y: number;
};

/** 从战报 summary 解析 `location_x` / `location_y`（不扩 proto）。 */
export function parseBattleReportLocation(
  summary: BattleReportSummary | undefined | null,
): BattleReportLocation | null {
  const coord = extractBattleReportReplayCoord(summary);
  if (!coord) return null;
  return { x: coord.wx, y: coord.wy };
}

export function formatBattleReportLocationFields(loc: BattleReportLocation): string {
  return `location_x=${loc.x} · location_y=${loc.y}`;
}

export type BattleReportMinimapFocusApplyResult = {
  replay: BattleReportReplayCoord;
  focusGrid: BattleReportReplayCoord;
  view: MinimapView;
  status: string;
  worldGrid: BattleReportLocation;
};

/**
 * 战报「在小地图定位」：CLIENT-042 复盘高亮 + pan/zoom；调用方负责 `openWorldMinimapExpanded`。
 */
export function applyBattleReportMinimapFocus(
  location: BattleReportLocation,
  bounds: MinimapWorldBounds,
  currentView: MinimapView,
): BattleReportMinimapFocusApplyResult {
  const replay: BattleReportReplayCoord = { wx: location.x, wy: location.y };
  const view = computeMinimapViewFramingPoints(bounds, [replay]);
  return {
    replay,
    focusGrid: replay,
    view,
    status: formatBattleReportReplayStatusExpanded(replay),
    worldGrid: location,
  };
}
