import type { BattleReportSummary } from "@/net/militaryFormat";

export type BattleReportListNavDirection = "prev" | "next";

/** 详情 `role=region` 的 aria-label，注明相邻战报快捷键（CLIENT-094）。 */
export const BATTLE_REPORT_DETAIL_REGION_ARIA_LABEL =
  "战报详情，方向键左或右、或 Alt+左或右切换上一封与下一封";

/**
 * 战报面板根节点属性：设为 `off` 关闭详情区方向键 / Alt+方向键相邻导航（见 client/README）。
 * @see BATTLE_REPORT_ADJ_NAV_KEYBOARD_ATTR
 */
export const BATTLE_REPORT_ADJ_NAV_KEYBOARD_ATTR = "data-battle-report-adj-nav-keyboard";

export function isBattleReportAdjNavKeyboardEnabled(root: HTMLElement): boolean {
  return root.getAttribute(BATTLE_REPORT_ADJ_NAV_KEYBOARD_ATTR) !== "off";
}

/** 与列表 DOM 相同顺序的 report_id 序列。 */
export function battleReportIdsInListOrder(
  reports: readonly BattleReportSummary[],
): number[] {
  const ids: number[] = [];
  for (const r of reports) {
    const id = r.report_id ?? 0;
    if (id > 0) ids.push(id);
  }
  return ids;
}

/**
 * 在有序 id 列表内移动：prev = 列表上一行（index-1），next = 下一行（index+1）。
 */
export function adjacentBattleReportId(
  orderedIds: readonly number[],
  currentId: number,
  direction: BattleReportListNavDirection,
): number | null {
  if (currentId <= 0 || !orderedIds.length) return null;
  const idx = orderedIds.indexOf(currentId);
  if (idx < 0) return null;
  const nextIdx = direction === "prev" ? idx - 1 : idx + 1;
  if (nextIdx < 0 || nextIdx >= orderedIds.length) return null;
  return orderedIds[nextIdx] ?? null;
}

/** 在已筛选后的摘要列表顺序内取相邻 report_id（与详情导航按钮同源）。 */
export function adjacentBattleReportIdInSummaries(
  reports: readonly BattleReportSummary[],
  currentId: number,
  direction: BattleReportListNavDirection,
): number | null {
  return adjacentBattleReportId(battleReportIdsInListOrder(reports), currentId, direction);
}
