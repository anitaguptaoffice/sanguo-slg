import { describe, expect, it } from "vitest";
import {
  battleReportOutcomeFilterChipPressed,
  BATTLE_REPORT_OUTCOME_FILTER_CHIP_ORDER,
  filterBattleReportsForPanelList,
  resolveBattleReportListOutcomeBadgeKind,
  syncBattleReportOutcomeFilterChips,
} from "@/net/battleReportOutcomeFilterChip";
import type { BattleReportSummary } from "@/net/militaryFormat";

describe("battleReportOutcomeFilterChip", () => {
  it("orders outcome chips all win loss draw", () => {
    expect(BATTLE_REPORT_OUTCOME_FILTER_CHIP_ORDER).toEqual(["all", "win", "loss", "draw"]);
  });

  it("resolveBattleReportListOutcomeBadgeKind maps win/loss only", () => {
    expect(resolveBattleReportListOutcomeBadgeKind(1)).toBe("win");
    expect(resolveBattleReportListOutcomeBadgeKind(2)).toBe("loss");
    expect(resolveBattleReportListOutcomeBadgeKind(3)).toBeNull();
    expect(resolveBattleReportListOutcomeBadgeKind(0)).toBeNull();
  });

  it("battleReportOutcomeFilterChipPressed reflects active filter", () => {
    expect(battleReportOutcomeFilterChipPressed("win", "win")).toBe(true);
    expect(battleReportOutcomeFilterChipPressed("all", "win")).toBe(false);
  });

  it("syncBattleReportOutcomeFilterChips sets aria-pressed and selected (CLIENT-121)", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <button type="button" data-action="filter-outcome" data-filter="all"></button>
      <button type="button" data-action="filter-outcome" data-filter="win"></button>`;
    syncBattleReportOutcomeFilterChips(root, "win");
    const all = root.querySelector<HTMLButtonElement>('[data-filter="all"]');
    const win = root.querySelector<HTMLButtonElement>('[data-filter="win"]');
    expect(all?.getAttribute("aria-pressed")).toBe("false");
    expect(win?.classList.contains("selected")).toBe(true);
    expect(win?.getAttribute("aria-pressed")).toBe("true");
    expect(win?.getAttribute("aria-current")).toBe("true");
  });

  it("filterBattleReportsForPanelList ANDs time window and outcome", () => {
    const reports: BattleReportSummary[] = [
      { report_id: 1, outcome: 1, created_at_ms: Date.UTC(2024, 5, 10) },
      { report_id: 2, outcome: 2, created_at_ms: Date.UTC(2024, 5, 10) },
      { report_id: 3, outcome: 1, created_at_ms: Date.UTC(2024, 4, 1) },
    ];
    const now = Date.UTC(2024, 5, 10, 12);
    const onlyWinsToday = filterBattleReportsForPanelList(reports, {
      outcomeFilter: "win",
      timeWindowFilter: "today",
      nowMs: now,
    });
    expect(onlyWinsToday.map((r) => r.report_id)).toEqual([1]);
  });
});
