import type { BattleReportListNavDirection } from "@/net/battleReportListNav";
import {
  battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestIndex,
  pulseBattleReportListKeyboardAdjacentNavResidualRings as pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestRings,
} from "@/net/battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepest";

/** CLIENT-366：j/k/↑/↓ 相邻条导航残余 **巩固再加深五层**环（CLIENT-350 四层环 **不退化**）。 */
export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS =
  "report-list-keyboard-adjacent-nav-residual-deepest-deepest-deepest-deeper-ring";

export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS = 2500;

const BATTLE_REPORT_LIST_ITEM_SELECTOR = "li[data-report-id]";

let adjacentNavResidualDeepestDeepestDeepestDeeperRingTimer: ReturnType<typeof setTimeout> | null =
  null;

/**
 * 筛选序内相邻条 roving 索引（与 CLIENT-350 `battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestIndex` 同源）。
 */
export function battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperIndex(
  orderedIds: readonly number[],
  selectedReportId: number,
  direction: BattleReportListNavDirection,
): number | null {
  return battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestIndex(
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

/** 相邻键盘导航命中行附加 `report-list-keyboard-adjacent-nav-residual-deepest-deepest-deepest-deeper-ring` 2.5s。 */
export function pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperRing(
  list: HTMLElement,
  reportId: number,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): boolean {
  const row = battleReportListRow(list, reportId);
  if (!row) return false;
  row.classList.remove(
    REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  );
  void row.offsetWidth;
  row.classList.add(
    REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  );
  if (adjacentNavResidualDeepestDeepestDeepestDeeperRingTimer != null) {
    windowObj.clearTimeout(adjacentNavResidualDeepestDeepestDeepestDeeperRingTimer);
  }
  adjacentNavResidualDeepestDeepestDeepestDeeperRingTimer = windowObj.setTimeout(() => {
    row.classList.remove(
      REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
    );
    adjacentNavResidualDeepestDeepestDeepestDeeperRingTimer = null;
  }, REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS);
  return true;
}

/** CLIENT-366：254/270/286/302/318/334/350 残余环链 + 366 巩固再加深五层环（CLIENT-286 密度行 **不退化**）。 */
export function pulseBattleReportListKeyboardAdjacentNavResidualRings(
  list: HTMLElement,
  reportId: number,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestRings(
    list,
    reportId,
    windowObj,
  );
  pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperRing(
    list,
    reportId,
    windowObj,
  );
}

/** @internal vitest */
export function resetBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperRingTimersForTests(): void {
  if (adjacentNavResidualDeepestDeepestDeepestDeeperRingTimer != null) {
    clearTimeout(adjacentNavResidualDeepestDeepestDeepestDeeperRingTimer);
    adjacentNavResidualDeepestDeepestDeepestDeeperRingTimer = null;
  }
}
