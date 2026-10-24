import { syncFilterChipAria } from "@/engine/artFilterChipRuntime";
import type { BattleReportTimeWindowFilter } from "@/net/militaryFormat";

/** Time window chips in battle report list toolbar (CLIENT-207 / CLIENT-121). */
export const BATTLE_REPORT_TIME_WINDOW_FILTER_CHIP_ORDER: readonly BattleReportTimeWindowFilter[] =
  ["all", "today", "last7d"];

export const BATTLE_REPORT_TIME_WINDOW_FILTER_CHIP_LABELS: Record<
  BattleReportTimeWindowFilter,
  string
> = {
  all: "全部",
  today: "今日",
  last7d: "近7日",
};

export function battleReportTimeWindowFilterChipPressed(
  chipFilter: BattleReportTimeWindowFilter,
  activeFilter: BattleReportTimeWindowFilter,
): boolean {
  return chipFilter === activeFilter;
}

/** Sync time-window chip a11y via CLIENT-121 `syncFilterChipAria`. */
export function syncBattleReportTimeFilterChips(
  root: ParentNode,
  activeFilter: BattleReportTimeWindowFilter,
  selector = 'button[data-action="filter-time-window"]',
): void {
  const chips = Array.from(root.querySelectorAll<HTMLButtonElement>(selector));
  syncFilterChipAria(chips, (btn) => {
    const raw = btn.getAttribute("data-filter") as BattleReportTimeWindowFilter | null;
    return raw != null && battleReportTimeWindowFilterChipPressed(raw, activeFilter);
  });
}
