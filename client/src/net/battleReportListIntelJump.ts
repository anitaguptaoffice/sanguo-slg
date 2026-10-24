import { parseBattleReportLocation } from "@/net/battleReportMinimapFocus";
import { resolveIntelRowNearCoords } from "@/net/battleReportIntelReplayJump";
import type { BattleReportSummary, MarchSummary } from "@/net/militaryFormat";

export const BATTLE_REPORT_LIST_INTEL_JUMP_ACTION = "report-list-intel-jump";
export const BATTLE_REPORT_LIST_INTEL_JUMP_TAG_CLASS = "report-list-intel-jump-tag";

export type BattleReportListIntelJumpTarget =
  | { mode: "intel"; marchId: number }
  | { mode: "minimap"; x: number; y: number };

/**
 * 列表坐标标签跳转：优先军情同源/最近目的格行军，否则回落小地图格点（CLIENT-223）。
 */
export function resolveBattleReportListIntelJump(
  summary: BattleReportSummary,
  marches: readonly MarchSummary[],
): BattleReportListIntelJumpTarget | null {
  const location = parseBattleReportLocation(summary);
  if (!location) return null;
  const intel = resolveIntelRowNearCoords([...marches], location.x, location.y);
  if (intel?.marchId != null && intel.marchId > 0) {
    return { mode: "intel", marchId: intel.marchId };
  }
  return { mode: "minimap", x: location.x, y: location.y };
}

export type BattleReportListIntelJumpHandlers = {
  openIntelMarch: (marchId: number) => void;
  openMinimapAtCoords: (x: number, y: number) => void;
  /** CLIENT-220 软依赖：`minimap-intel-sync-ring` 合入后由场景替换为真实高亮。 */
  afterIntelJumpSyncStub?: (marchId: number) => void;
};

/** 纯跳转分发（单测与场景共用）。 */
export function dispatchBattleReportListIntelJump(
  summary: BattleReportSummary,
  marches: readonly MarchSummary[],
  handlers: BattleReportListIntelJumpHandlers,
): "intel" | "minimap" | "none" {
  const target = resolveBattleReportListIntelJump(summary, marches);
  if (!target) return "none";
  if (target.mode === "intel") {
    handlers.openIntelMarch(target.marchId);
    handlers.afterIntelJumpSyncStub?.(target.marchId);
    return "intel";
  }
  handlers.openMinimapAtCoords(target.x, target.y);
  return "minimap";
}

/** CLIENT-220 未合入时的空操作跳转钩子。 */
export function stubIntelMinimapSyncAfterReportListJump(_marchId: number): void {
  /* no-op */
}
