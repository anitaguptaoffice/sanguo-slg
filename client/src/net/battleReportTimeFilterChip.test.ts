import { describe, expect, it } from "vitest";
import {
  BATTLE_REPORT_TIME_WINDOW_FILTER_CHIP_LABELS,
  BATTLE_REPORT_TIME_WINDOW_FILTER_CHIP_ORDER,
  battleReportTimeWindowFilterChipPressed,
  syncBattleReportTimeFilterChips,
} from "@/net/battleReportTimeFilterChip";

describe("battleReportTimeFilterChip", () => {
  it("orders time window chips all today last7d", () => {
    expect(BATTLE_REPORT_TIME_WINDOW_FILTER_CHIP_ORDER).toEqual(["all", "today", "last7d"]);
    expect(BATTLE_REPORT_TIME_WINDOW_FILTER_CHIP_LABELS.today).toBe("今日");
  });

  it("battleReportTimeWindowFilterChipPressed reflects active filter", () => {
    expect(battleReportTimeWindowFilterChipPressed("today", "today")).toBe(true);
    expect(battleReportTimeWindowFilterChipPressed("all", "today")).toBe(false);
  });

  it("syncBattleReportTimeFilterChips sets aria-pressed (CLIENT-207)", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <button type="button" data-action="filter-time-window" data-filter="all"></button>
      <button type="button" data-action="filter-time-window" data-filter="today"></button>`;
    syncBattleReportTimeFilterChips(root, "today");
    const all = root.querySelector<HTMLButtonElement>('[data-filter="all"]');
    const today = root.querySelector<HTMLButtonElement>('[data-filter="today"]');
    expect(all?.getAttribute("aria-pressed")).toBe("false");
    expect(today?.getAttribute("aria-pressed")).toBe("true");
    expect(today?.classList.contains("selected")).toBe(true);
  });
});
