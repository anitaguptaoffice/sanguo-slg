import type { BattleReportListNavDirection } from "@/net/battleReportListNav";
import {
  battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperIndex,
  pulseBattleReportListKeyboardAdjacentNavResidualRings as pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperRings,
} from "@/net/battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeper";

/** CLIENT-382：j/k/↑/↓ 相邻条导航残余 **巩固再加深五层**环（CLIENT-366 五层环 **不退化**）。 */
export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS =
  "report-list-keyboard-adjacent-nav-residual-deepest-deepest-deepest-deepest-deeper-ring";

export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS = 2500;

const BATTLE_REPORT_LIST_ITEM_SELECTOR = "li[data-report-id]";

let adjacentNavResidualDeepestDeepestDeepestDeepestDeeperRingTimer: ReturnType<
  typeof setTimeout
> | null = null;

/**
 * 筛选序内相邻条 roving 索引（与 CLIENT-366 `battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperIndex` 同源）。
 */
export function battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeepestDeeperIndex(
  orderedIds: readonly number[],
  selectedReportId: number,
  direction: BattleReportListNavDirection,
): number | null {
  return battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperIndex(
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

/** 相邻键盘导航命中行附加 `report-list-keyboard-adjacent-nav-residual-deepest-deepest-deepest-deepest-deeper-ring` 2.5s。 */
export function pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeepestDeeperRing(
  list: HTMLElement,
  reportId: number,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): boolean {
  const row = battleReportListRow(list, reportId);
  if (!row) return false;
  row.classList.remove(
    REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  );
  void row.offsetWidth;
  row.classList.add(
    REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  );
  if (adjacentNavResidualDeepestDeepestDeepestDeepestDeeperRingTimer != null) {
    windowObj.clearTimeout(adjacentNavResidualDeepestDeepestDeepestDeepestDeeperRingTimer);
  }
  adjacentNavResidualDeepestDeepestDeepestDeepestDeeperRingTimer = windowObj.setTimeout(() => {
    row.classList.remove(
      REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
    );
    adjacentNavResidualDeepestDeepestDeepestDeepestDeeperRingTimer = null;
  }, REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS);
  return true;
}

/** CLIENT-382：254/270/286/302/318/334/350/366 残余环链 + 382 巩固再加深五层环（CLIENT-286 密度行 **不退化**）。 */
export function pulseBattleReportListKeyboardAdjacentNavResidualRings(
  list: HTMLElement,
  reportId: number,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperRings(
    list,
    reportId,
    windowObj,
  );
  pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeepestDeeperRing(
    list,
    reportId,
    windowObj,
  );
}

/** @internal vitest */
export function resetBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeepestDeeperRingTimersForTests(): void {
  if (adjacentNavResidualDeepestDeepestDeepestDeepestDeeperRingTimer != null) {
    clearTimeout(adjacentNavResidualDeepestDeepestDeepestDeepestDeeperRingTimer);
    adjacentNavResidualDeepestDeepestDeepestDeepestDeeperRingTimer = null;
  }
}
