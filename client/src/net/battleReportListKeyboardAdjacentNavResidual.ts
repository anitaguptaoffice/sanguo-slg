import type { BattleReportListNavDirection } from "@/net/battleReportListNav";
import { battleReportListKeyboardFocusIndex } from "@/net/battleReportListDensityKeyboard";

/** CLIENT-254：j/k/↑/↓ 相邻条导航残余环（CLIENT-239 焦点环 **不退化**）。 */
export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_CLASS =
  "report-list-keyboard-adjacent-nav-residual-ring";

export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_MS = 2000;

const BATTLE_REPORT_LIST_ITEM_SELECTOR = "li[data-report-id]";

let adjacentNavResidualRingTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 筛选序内相邻条 roving 索引（与 CLIENT-239 `battleReportListKeyboardFocusIndex` 同源）。
 */
export function battleReportListKeyboardAdjacentNavIndex(
  orderedIds: readonly number[],
  selectedReportId: number,
  direction: BattleReportListNavDirection,
): number | null {
  return battleReportListKeyboardFocusIndex(orderedIds, selectedReportId, direction);
}

function battleReportListRow(
  list: HTMLElement,
  reportId: number,
): HTMLElement | null {
  return list.querySelector<HTMLElement>(
    `${BATTLE_REPORT_LIST_ITEM_SELECTOR}[data-report-id="${reportId}"]`,
  );
}

/** 相邻键盘导航命中行附加 `report-list-keyboard-adjacent-nav-residual-ring` 2s。 */
export function pulseBattleReportListKeyboardAdjacentNavResidualRing(
  list: HTMLElement,
  reportId: number,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): boolean {
  const row = battleReportListRow(list, reportId);
  if (!row) return false;
  row.classList.remove(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_CLASS);
  void row.offsetWidth;
  row.classList.add(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_CLASS);
  if (adjacentNavResidualRingTimer != null) {
    windowObj.clearTimeout(adjacentNavResidualRingTimer);
  }
  adjacentNavResidualRingTimer = windowObj.setTimeout(() => {
    row.classList.remove(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_CLASS);
    adjacentNavResidualRingTimer = null;
  }, REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_MS);
  return true;
}

/** @internal vitest */
export function resetBattleReportListKeyboardAdjacentNavResidualRingTimersForTests(): void {
  if (adjacentNavResidualRingTimer != null) {
    clearTimeout(adjacentNavResidualRingTimer);
    adjacentNavResidualRingTimer = null;
  }
}
