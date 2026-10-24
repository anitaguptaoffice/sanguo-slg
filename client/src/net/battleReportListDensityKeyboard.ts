import type { BattleReportSummary } from "@/net/militaryFormat";
import {
  battleReportOutcomeChipClass,
  formatReportCoord,
  formatTimeMs,
  formatBattleReportFoeWithoutCoord,
} from "@/net/militaryFormat";
import type { BattleReportListNavDirection } from "@/net/battleReportListNav";
import { battleReportListRovingFocusIndex } from "@/net/battleReportListNav";

/** 战报列表密度行根 class（CLIENT-239）。 */
export const REPORT_LIST_DENSITY_ROW_CLASS = "report-list-density-row";

/** 列表行内 outcome 色带（CLIENT-239 / CLIENT-190 同级扫读）。 */
export const REPORT_LIST_DENSITY_OUTCOME_BAND_CLASS = "report-list-density-outcome-band";

/** 时间戳单行扫读（CLIENT-239）。 */
export const REPORT_LIST_DENSITY_TIMESTAMP_CLASS = "report-list-density-timestamp";

/** 坐标次行（CLIENT-239）。 */
export const REPORT_LIST_DENSITY_COORD_CLASS = "report-list-density-coord";

/** j/k 或面板内 ↑/↓ 导航后的列表行焦点环（CLIENT-239）。 */
export const REPORT_LIST_KEYBOARD_FOCUS_RING_CLASS = "report-list-keyboard-focus-ring";

/**
 * 战报面板根节点：设为 `off` 关闭 j/k 与面板内 ↑/↓ 列表相邻导航（见 client/README）。
 */
export const BATTLE_REPORT_LIST_KEYBOARD_ATTR = "data-battle-report-list-keyboard";

export function isBattleReportListKeyboardNavEnabled(root: HTMLElement): boolean {
  return root.getAttribute(BATTLE_REPORT_LIST_KEYBOARD_ATTR) !== "off";
}

export function formatBattleReportListDensityTitleLine(r: BattleReportSummary): string {
  const id = r.report_id ?? "?";
  return `#${id} · ${formatBattleReportFoeWithoutCoord(r)}`;
}

export function formatBattleReportListDensityTimestampLine(r: BattleReportSummary): string {
  return formatTimeMs(r.created_at_ms);
}

export function formatBattleReportListDensityCoordLine(r: BattleReportSummary): string {
  return formatReportCoord(r);
}

export function applyBattleReportListDensityRowClasses(
  li: HTMLElement,
  summary: BattleReportSummary,
): void {
  li.classList.add(REPORT_LIST_DENSITY_ROW_CLASS);
  const band = li.querySelector(`.${REPORT_LIST_DENSITY_OUTCOME_BAND_CLASS}`);
  if (band) {
    band.className = `${REPORT_LIST_DENSITY_OUTCOME_BAND_CLASS} ${battleReportOutcomeChipClass(summary.outcome)}`;
  }
}

export function battleReportListKeyboardDirectionFromKey(
  key: string,
): BattleReportListNavDirection | null {
  if (key === "ArrowUp" || key === "k" || key === "K") return "prev";
  if (key === "ArrowDown" || key === "j" || key === "J") return "next";
  return null;
}

/**
 * 在筛选序内按方向步进后的 roving 索引；无法移动时返回 null。
 */
export function battleReportListKeyboardFocusIndex(
  orderedIds: readonly number[],
  selectedReportId: number,
  direction: BattleReportListNavDirection,
): number | null {
  if (!orderedIds.length) return null;
  const currentIdx = battleReportListRovingFocusIndex(orderedIds, selectedReportId);
  const delta = direction === "prev" ? -1 : 1;
  const nextIdx = currentIdx + delta;
  if (nextIdx < 0 || nextIdx >= orderedIds.length) return null;
  return nextIdx;
}

const BATTLE_REPORT_LIST_ITEM_SELECTOR = "li[data-report-id]";

function battleReportListRows(list: HTMLElement): HTMLElement[] {
  return Array.from(
    list.querySelectorAll<HTMLElement>(BATTLE_REPORT_LIST_ITEM_SELECTOR),
  ).filter(
    (el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true",
  );
}

export function syncBattleReportListKeyboardFocusRing(
  list: HTMLElement,
  selectedReportId: number,
): void {
  for (const row of battleReportListRows(list)) {
    const id = Number(row.getAttribute("data-report-id"));
    row.classList.toggle(
      REPORT_LIST_KEYBOARD_FOCUS_RING_CLASS,
      id > 0 && id === selectedReportId,
    );
  }
}

export type BattleReportListPanelKeyDownOptions = {
  panel: HTMLElement;
  list: HTMLElement;
  orderedIds: readonly number[];
  selectedReportId: number;
  onSelectReportId: (reportId: number) => void;
};

/**
 * 面板聚焦时 j/k 或 ↑/↓ 驱动相邻战报行（CLIENT-239）。
 * 列表行已聚焦时的 ↑/↓ 由 {@link handleListRovingKeyDown} 处理，此处返回 false。
 */
export function handleBattleReportListPanelKeyDown(
  ev: KeyboardEvent,
  options: BattleReportListPanelKeyDownOptions,
): boolean {
  if (!isBattleReportListKeyboardNavEnabled(options.panel)) return false;
  const direction = battleReportListKeyboardDirectionFromKey(ev.key);
  if (!direction) return false;

  const target =
    (ev.target as HTMLElement | null) ??
    (document.activeElement as HTMLElement | null);
  if (
    target &&
    (target.closest("input, textarea, select") || target.isContentEditable)
  ) {
    return false;
  }
  if (!target || !options.panel.contains(target)) return false;

  if (
    (ev.key === "ArrowUp" || ev.key === "ArrowDown") &&
    target.closest(BATTLE_REPORT_LIST_ITEM_SELECTOR)
  ) {
    return false;
  }

  const nextIdx = battleReportListKeyboardFocusIndex(
    options.orderedIds,
    options.selectedReportId,
    direction,
  );
  if (nextIdx == null) return false;

  const nextId = options.orderedIds[nextIdx];
  if (nextId == null || nextId <= 0) return false;

  ev.preventDefault();
  options.onSelectReportId(nextId);
  syncBattleReportListKeyboardFocusRing(options.list, nextId);
  return true;
}
