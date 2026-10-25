import type { BattleReportListNavDirection } from "@/net/battleReportListNav";
import {
  battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperIndex,
  pulseBattleReportListKeyboardAdjacentNavResidualRings as pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperRings,
} from "@/net/battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeper";

/** CLIENT-350：j/k/↑/↓ 相邻条导航残余 **巩固再加深四层**环（CLIENT-334 更深三层环 **不退化**）。 */
export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS =
  "report-list-keyboard-adjacent-nav-residual-deepest-deepest-deepest-ring";

export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_MS = 2500;

const BATTLE_REPORT_LIST_ITEM_SELECTOR = "li[data-report-id]";

let adjacentNavResidualDeepestDeepestDeepestRingTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 筛选序内相邻条 roving 索引（与 CLIENT-334 `battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperIndex` 同源）。
 */
export function battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestIndex(
  orderedIds: readonly number[],
  selectedReportId: number,
  direction: BattleReportListNavDirection,
): number | null {
  return battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperIndex(
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

/** 相邻键盘导航命中行附加 `report-list-keyboard-adjacent-nav-residual-deepest-deepest-deepest-ring` 2.5s。 */
export function pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestRing(
  list: HTMLElement,
  reportId: number,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): boolean {
  const row = battleReportListRow(list, reportId);
  if (!row) return false;
  row.classList.remove(
    REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS,
  );
  void row.offsetWidth;
  row.classList.add(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS);
  if (adjacentNavResidualDeepestDeepestDeepestRingTimer != null) {
    windowObj.clearTimeout(adjacentNavResidualDeepestDeepestDeepestRingTimer);
  }
  adjacentNavResidualDeepestDeepestDeepestRingTimer = windowObj.setTimeout(() => {
    row.classList.remove(
      REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS,
    );
    adjacentNavResidualDeepestDeepestDeepestRingTimer = null;
  }, REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_MS);
  return true;
}

/** CLIENT-350：254/270/286/302/318/334 残余环链 + 350 巩固再加深四层环（CLIENT-286 密度行 **不退化**）。 */
export function pulseBattleReportListKeyboardAdjacentNavResidualRings(
  list: HTMLElement,
  reportId: number,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperRings(list, reportId, windowObj);
  pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestRing(list, reportId, windowObj);
}

/** @internal vitest */
export function resetBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestRingTimersForTests(): void {
  if (adjacentNavResidualDeepestDeepestDeepestRingTimer != null) {
    clearTimeout(adjacentNavResidualDeepestDeepestDeepestRingTimer);
    adjacentNavResidualDeepestDeepestDeepestRingTimer = null;
  }
}
