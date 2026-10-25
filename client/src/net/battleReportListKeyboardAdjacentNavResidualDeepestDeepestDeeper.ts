import type { BattleReportListNavDirection } from "@/net/battleReportListNav";
import {
  battleReportListKeyboardAdjacentNavResidualDeepestDeeperIndex,
  pulseBattleReportListKeyboardAdjacentNavResidualRings as pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeeperRings,
} from "@/net/battleReportListKeyboardAdjacentNavResidualDeepestDeeper";

/** CLIENT-334：j/k/↑/↓ 相邻条导航残余 **巩固再加深三层**环（CLIENT-318 更深二层环 **不退化**）。 */
export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS =
  "report-list-keyboard-adjacent-nav-residual-deepest-deepest-deeper-ring";

export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_MS = 2500;

const BATTLE_REPORT_LIST_ITEM_SELECTOR = "li[data-report-id]";

let adjacentNavResidualDeepestDeepestDeeperRingTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 筛选序内相邻条 roving 索引（与 CLIENT-318 `battleReportListKeyboardAdjacentNavResidualDeepestDeeperIndex` 同源）。
 */
export function battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperIndex(
  orderedIds: readonly number[],
  selectedReportId: number,
  direction: BattleReportListNavDirection,
): number | null {
  return battleReportListKeyboardAdjacentNavResidualDeepestDeeperIndex(
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

/** 相邻键盘导航命中行附加 `report-list-keyboard-adjacent-nav-residual-deepest-deepest-deeper-ring` 2.5s。 */
export function pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperRing(
  list: HTMLElement,
  reportId: number,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): boolean {
  const row = battleReportListRow(list, reportId);
  if (!row) return false;
  row.classList.remove(
    REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  );
  void row.offsetWidth;
  row.classList.add(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS);
  if (adjacentNavResidualDeepestDeepestDeeperRingTimer != null) {
    windowObj.clearTimeout(adjacentNavResidualDeepestDeepestDeeperRingTimer);
  }
  adjacentNavResidualDeepestDeepestDeeperRingTimer = windowObj.setTimeout(() => {
    row.classList.remove(
      REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
    );
    adjacentNavResidualDeepestDeepestDeeperRingTimer = null;
  }, REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_MS);
  return true;
}

/** CLIENT-334：254/270/286/302/318 残余+深+更深+最深+最深二层环 + 334 巩固再加深三层环（CLIENT-239 密度行 **不退化**）。 */
export function pulseBattleReportListKeyboardAdjacentNavResidualRings(
  list: HTMLElement,
  reportId: number,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeeperRings(list, reportId, windowObj);
  pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperRing(list, reportId, windowObj);
}

/** @internal vitest */
export function resetBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperRingTimersForTests(): void {
  if (adjacentNavResidualDeepestDeepestDeeperRingTimer != null) {
    clearTimeout(adjacentNavResidualDeepestDeepestDeeperRingTimer);
    adjacentNavResidualDeepestDeepestDeeperRingTimer = null;
  }
}
