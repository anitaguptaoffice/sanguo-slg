import { syncFilterChipAria } from "@/engine/artFilterChipRuntime";
import {
  filterBattleReportsByLocation,
  filterBattleReportsByOutcome,
  filterBattleReportsByTimeWindow,
  type BattleReportOutcomeFilter,
  type BattleReportSummary,
  type BattleReportTimeWindowFilter,
} from "@/net/militaryFormat";

/** Outcome filter chips shown in the battle report list toolbar (CLIENT-125 / CLIENT-121). */
export const BATTLE_REPORT_OUTCOME_FILTER_CHIP_ORDER: readonly BattleReportOutcomeFilter[] = [
  "all",
  "win",
  "loss",
  "draw",
];

export type BattleReportListOutcomeBadgeKind = "win" | "loss" | null;

/** Win/loss rows use `badge.dot`; draw/unknown keep text chip only. */
export function resolveBattleReportListOutcomeBadgeKind(
  outcome: number | undefined,
): BattleReportListOutcomeBadgeKind {
  if (outcome === 1) return "win";
  if (outcome === 2) return "loss";
  return null;
}

export function battleReportOutcomeFilterChipPressed(
  chipFilter: BattleReportOutcomeFilter,
  activeFilter: BattleReportOutcomeFilter,
): boolean {
  return chipFilter === activeFilter;
}

/** Sync chip a11y via CLIENT-121 `syncFilterChipAria` (selected sprite + aria-pressed). */
export function syncBattleReportOutcomeFilterChips(
  root: ParentNode,
  activeFilter: BattleReportOutcomeFilter,
  selector = 'button[data-action="filter-outcome"]',
): void {
  const chips = Array.from(root.querySelectorAll<HTMLButtonElement>(selector));
  syncFilterChipAria(chips, (btn) => {
    const raw = btn.getAttribute("data-filter") as BattleReportOutcomeFilter | null;
    return raw != null && battleReportOutcomeFilterChipPressed(raw, activeFilter);
  });
}

export type BattleReportPanelListFilters = {
  outcomeFilter: BattleReportOutcomeFilter;
  timeWindowFilter: BattleReportTimeWindowFilter;
  nowMs?: number;
  location?: { x: number; y: number } | null;
};

/** CLIENT-065 time window AND outcome filter (optional grid), list-only. */
export function filterBattleReportsForPanelList(
  reports: BattleReportSummary[],
  filters: BattleReportPanelListFilters,
): BattleReportSummary[] {
  const nowMs = filters.nowMs ?? Date.now();
  let list = filterBattleReportsByTimeWindow(reports, filters.timeWindowFilter, nowMs);
  list = filterBattleReportsByOutcome(list, filters.outcomeFilter);
  const loc = filters.location;
  if (loc != null) {
    list = filterBattleReportsByLocation(list, loc.x, loc.y);
  }
  return list;
}
