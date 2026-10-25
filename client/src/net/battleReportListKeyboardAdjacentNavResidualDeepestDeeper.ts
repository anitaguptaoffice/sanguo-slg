import type { BattleReportListNavDirection } from "@/net/battleReportListNav";
import {
  battleReportListKeyboardAdjacentNavResidualDeepestIndex,
  pulseBattleReportListKeyboardAdjacentNavResidualRings as pulseBattleReportListKeyboardAdjacentNavResidualDeepestRings,
} from "@/net/battleReportListKeyboardAdjacentNavResidualDeepest";

/** CLIENT-318：j/k/↑/↓ 相邻条导航残余 **巩固再加深二层**环（CLIENT-302 更深一层环 **不退化**）。 */
export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPER_RING_CLASS =
  "report-list-keyboard-adjacent-nav-residual-deepest-deeper-ring";

export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPER_RING_MS = 2500;

const BATTLE_REPORT_LIST_ITEM_SELECTOR = "li[data-report-id]";

let adjacentNavResidualDeepestDeeperRingTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 筛选序内相邻条 roving 索引（与 CLIENT-302 `battleReportListKeyboardAdjacentNavResidualDeepestIndex` 同源）。
 */
export function battleReportListKeyboardAdjacentNavResidualDeepestDeeperIndex(
  orderedIds: readonly number[],
  selectedReportId: number,
  direction: BattleReportListNavDirection,
): number | null {
  return battleReportListKeyboardAdjacentNavResidualDeepestIndex(
    orderedIds,
    selectedReportId,
    direction,
  );
}

function battleReportListRow(
  list: HTMLElement,
  reportId: number,
): HTMLElement | null {
  return list.querySelector<HTMLElement>(
    `${BATTLE_REPORT_LIST_ITEM_SELECTOR}[data-report-id="${reportId}"]`,
  );
}

/** 相邻键盘导航命中行附加 `report-list-keyboard-adjacent-nav-residual-deepest-deeper-ring` 2.5s。 */
export function pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeeperRing(
  list: HTMLElement,
  reportId: number,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): boolean {
  const row = battleReportListRow(list, reportId);
  if (!row) return false;
  row.classList.remove(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPER_RING_CLASS);
  void row.offsetWidth;
  row.classList.add(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPER_RING_CLASS);
  if (adjacentNavResidualDeepestDeeperRingTimer != null) {
    windowObj.clearTimeout(adjacentNavResidualDeepestDeeperRingTimer);
  }
  adjacentNavResidualDeepestDeeperRingTimer = windowObj.setTimeout(() => {
    row.classList.remove(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPER_RING_CLASS);
    adjacentNavResidualDeepestDeeperRingTimer = null;
  }, REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPER_RING_MS);
  return true;
}

/** CLIENT-318：254/270/286/302 残余+深+更深+最深环 + 318 巩固再加深二层环（CLIENT-239 密度行 **不退化**）。 */
export function pulseBattleReportListKeyboardAdjacentNavResidualRings(
  list: HTMLElement,
  reportId: number,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  pulseBattleReportListKeyboardAdjacentNavResidualDeepestRings(list, reportId, windowObj);
  pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeeperRing(list, reportId, windowObj);
}

/** @internal vitest */
export function resetBattleReportListKeyboardAdjacentNavResidualDeepestDeeperRingTimersForTests(): void {
  if (adjacentNavResidualDeepestDeeperRingTimer != null) {
    clearTimeout(adjacentNavResidualDeepestDeeperRingTimer);
    adjacentNavResidualDeepestDeeperRingTimer = null;
  }
}
