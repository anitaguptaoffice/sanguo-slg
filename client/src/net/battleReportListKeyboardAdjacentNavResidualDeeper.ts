import type { BattleReportListNavDirection } from "@/net/battleReportListNav";
import {
  battleReportListKeyboardAdjacentNavResidualDeepIndex,
  pulseBattleReportListKeyboardAdjacentNavResidualRings as pulseBattleReportListKeyboardAdjacentNavResidualDeepRings,
} from "@/net/battleReportListKeyboardAdjacentNavResidualDeep";

/** CLIENT-286：j/k/↑/↓ 相邻条导航残余 **巩固再加深**环（CLIENT-270 深环 **不退化**）。 */
export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPER_RING_CLASS =
  "report-list-keyboard-adjacent-nav-residual-deeper-ring";

export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPER_RING_MS = 2500;

const BATTLE_REPORT_LIST_ITEM_SELECTOR = "li[data-report-id]";

let adjacentNavResidualDeeperRingTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 筛选序内相邻条 roving 索引（与 CLIENT-270 `battleReportListKeyboardAdjacentNavResidualDeepIndex` 同源）。
 */
export function battleReportListKeyboardAdjacentNavResidualDeeperIndex(
  orderedIds: readonly number[],
  selectedReportId: number,
  direction: BattleReportListNavDirection,
): number | null {
  return battleReportListKeyboardAdjacentNavResidualDeepIndex(
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

/** 相邻键盘导航命中行附加 `report-list-keyboard-adjacent-nav-residual-deeper-ring` 2.5s。 */
export function pulseBattleReportListKeyboardAdjacentNavResidualDeeperRing(
  list: HTMLElement,
  reportId: number,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): boolean {
  const row = battleReportListRow(list, reportId);
  if (!row) return false;
  row.classList.remove(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPER_RING_CLASS);
  void row.offsetWidth;
  row.classList.add(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPER_RING_CLASS);
  if (adjacentNavResidualDeeperRingTimer != null) {
    windowObj.clearTimeout(adjacentNavResidualDeeperRingTimer);
  }
  adjacentNavResidualDeeperRingTimer = windowObj.setTimeout(() => {
    row.classList.remove(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPER_RING_CLASS);
    adjacentNavResidualDeeperRingTimer = null;
  }, REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPER_RING_MS);
  return true;
}

/** CLIENT-286：254/270 残余+深环 + 286 巩固再加深环（CLIENT-239 密度行 **不退化**）。 */
export function pulseBattleReportListKeyboardAdjacentNavResidualRings(
  list: HTMLElement,
  reportId: number,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  pulseBattleReportListKeyboardAdjacentNavResidualDeepRings(list, reportId, windowObj);
  pulseBattleReportListKeyboardAdjacentNavResidualDeeperRing(list, reportId, windowObj);
}

/** @internal vitest */
export function resetBattleReportListKeyboardAdjacentNavResidualDeeperRingTimersForTests(): void {
  if (adjacentNavResidualDeeperRingTimer != null) {
    clearTimeout(adjacentNavResidualDeeperRingTimer);
    adjacentNavResidualDeeperRingTimer = null;
  }
}
