import type { BattleReportListNavDirection } from "@/net/battleReportListNav";
import { battleReportListKeyboardAdjacentNavIndex } from "@/net/battleReportListKeyboardAdjacentNavResidual";
import { pulseBattleReportListKeyboardAdjacentNavResidualRing } from "@/net/battleReportListKeyboardAdjacentNavResidual";

/** CLIENT-270：j/k/↑/↓ 相邻条导航残余 **深**环（CLIENT-254 2s 环 **不退化**）。 */
export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEP_RING_CLASS =
  "report-list-keyboard-adjacent-nav-residual-deep-ring";

export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEP_RING_MS = 2500;

const BATTLE_REPORT_LIST_ITEM_SELECTOR = "li[data-report-id]";

let adjacentNavResidualDeepRingTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 筛选序内相邻条 roving 索引（与 CLIENT-254 `battleReportListKeyboardAdjacentNavIndex` 同源）。
 */
export function battleReportListKeyboardAdjacentNavResidualDeepIndex(
  orderedIds: readonly number[],
  selectedReportId: number,
  direction: BattleReportListNavDirection,
): number | null {
  return battleReportListKeyboardAdjacentNavIndex(orderedIds, selectedReportId, direction);
}

function battleReportListRow(
  list: HTMLElement,
  reportId: number,
): HTMLElement | null {
  return list.querySelector<HTMLElement>(
    `${BATTLE_REPORT_LIST_ITEM_SELECTOR}[data-report-id="${reportId}"]`,
  );
}

/** 相邻键盘导航命中行附加 `report-list-keyboard-adjacent-nav-residual-deep-ring` 2.5s。 */
export function pulseBattleReportListKeyboardAdjacentNavResidualDeepRing(
  list: HTMLElement,
  reportId: number,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): boolean {
  const row = battleReportListRow(list, reportId);
  if (!row) return false;
  row.classList.remove(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEP_RING_CLASS);
  void row.offsetWidth;
  row.classList.add(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEP_RING_CLASS);
  if (adjacentNavResidualDeepRingTimer != null) {
    windowObj.clearTimeout(adjacentNavResidualDeepRingTimer);
  }
  adjacentNavResidualDeepRingTimer = windowObj.setTimeout(() => {
    row.classList.remove(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEP_RING_CLASS);
    adjacentNavResidualDeepRingTimer = null;
  }, REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEP_RING_MS);
  return true;
}

/** CLIENT-270：254 残余环 + 270 深环并存（CLIENT-239 密度行 **不退化**）。 */
export function pulseBattleReportListKeyboardAdjacentNavResidualRings(
  list: HTMLElement,
  reportId: number,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  pulseBattleReportListKeyboardAdjacentNavResidualRing(list, reportId, windowObj);
  pulseBattleReportListKeyboardAdjacentNavResidualDeepRing(list, reportId, windowObj);
}

/** @internal vitest */
export function resetBattleReportListKeyboardAdjacentNavResidualDeepRingTimersForTests(): void {
  if (adjacentNavResidualDeepRingTimer != null) {
    clearTimeout(adjacentNavResidualDeepRingTimer);
    adjacentNavResidualDeepRingTimer = null;
  }
}
