import { describe, expect, it } from "vitest";
import {
  adjacentBattleReportId,
  adjacentBattleReportIdInSummaries,
  applyBattleReportAdjNavFocusRing,
  BATTLE_REPORT_ADJACENT_FOCUS_RING_CLASS,
  battleReportIdsInListOrder,
  battleReportListRovingFocusIndex,
  setBattleReportAdjNavButtonEnabled,
  syncBattleReportListRovingFocus,
} from "@/net/battleReportListNav";
import {
  filterBattleReportsByOutcome,
  filterBattleReportsByTimeWindow,
} from "@/net/militaryFormat";

describe("battleReportListNav", () => {
  const reports = [
    { report_id: 10, outcome: 1 },
    { report_id: 8, outcome: 2 },
    { report_id: 5, outcome: 1 },
  ];
  const ids = battleReportIdsInListOrder(reports);

  it("extracts ids in list order", () => {
    expect(ids).toEqual([10, 8, 5]);
    expect(battleReportIdsInListOrder([{ report_id: 0 }, { outcome: 1 }])).toEqual([]);
  });

  it("navigates prev/next within ordered list", () => {
    expect(adjacentBattleReportId(ids, 8, "prev")).toBe(10);
    expect(adjacentBattleReportId(ids, 8, "next")).toBe(5);
    expect(adjacentBattleReportId(ids, 10, "prev")).toBeNull();
    expect(adjacentBattleReportId(ids, 5, "next")).toBeNull();
    expect(adjacentBattleReportId(ids, 99, "next")).toBeNull();
  });

  it("adjacent id respects outcome and time-window filtered list", () => {
    const mixed = [
      { report_id: 20, outcome: 1, created_at_ms: Date.UTC(2024, 5, 2) },
      { report_id: 15, outcome: 2, created_at_ms: Date.UTC(2024, 5, 2) },
      { report_id: 12, outcome: 1, created_at_ms: Date.UTC(2024, 4, 1) },
    ];
    const winsOnly = filterBattleReportsByOutcome(mixed, "win");
    expect(adjacentBattleReportIdInSummaries(winsOnly, 20, "next")).toBe(12);
    expect(adjacentBattleReportIdInSummaries(winsOnly, 12, "prev")).toBe(20);

    const noonToday = new Date();
    noonToday.setHours(12, 0, 0, 0);
    const todayMs = noonToday.getTime();
    const yesterday = new Date(noonToday);
    yesterday.setDate(yesterday.getDate() - 1);
    const windowed = [
      { report_id: 20, outcome: 1, created_at_ms: todayMs },
      { report_id: 15, outcome: 2, created_at_ms: todayMs },
      { report_id: 12, outcome: 1, created_at_ms: yesterday.getTime() },
    ];
    const todayOnly = filterBattleReportsByTimeWindow(windowed, "today", todayMs);
    const visible = filterBattleReportsByOutcome(todayOnly, "all");
    expect(adjacentBattleReportIdInSummaries(visible, 15, "prev")).toBe(20);
    expect(adjacentBattleReportIdInSummaries(visible, 20, "next")).toBe(15);
  });

  it("roving focus index tracks selected id in filtered order (CLIENT-158)", () => {
    const ids = [10, 8, 5];
    expect(battleReportListRovingFocusIndex(ids, 8)).toBe(1);
    expect(battleReportListRovingFocusIndex(ids, 99)).toBe(0);
    expect(battleReportListRovingFocusIndex([], 10)).toBe(0);
  });

  it("syncBattleReportListRovingFocus sets tabindex on matching row", () => {
    const ul = document.createElement("ul");
    ul.innerHTML = `<li data-report-id="10"></li><li data-report-id="8"></li><li data-report-id="5"></li>`;
    syncBattleReportListRovingFocus(ul, [10, 8, 5], 8);
    const items = ul.querySelectorAll("li");
    expect(items[0].tabIndex).toBe(-1);
    expect(items[1].tabIndex).toBe(0);
    expect(items[2].tabIndex).toBe(-1);
  });

  it("adj nav buttons expose aria-disabled when disabled (CLIENT-158)", () => {
    const btn = document.createElement("button");
    setBattleReportAdjNavButtonEnabled(btn, false);
    expect(btn.disabled).toBe(true);
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    setBattleReportAdjNavButtonEnabled(btn, true);
    expect(btn.disabled).toBe(false);
    expect(btn.getAttribute("aria-disabled")).toBe("false");
  });

  it("applyBattleReportAdjNavFocusRing adds adjacent focus class (CLIENT-190)", () => {
    const btn = document.createElement("button");
    applyBattleReportAdjNavFocusRing(btn);
    expect(btn.classList.contains(BATTLE_REPORT_ADJACENT_FOCUS_RING_CLASS)).toBe(true);
  });
});
