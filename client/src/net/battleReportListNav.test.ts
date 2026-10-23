import { describe, expect, it } from "vitest";
import {
  adjacentBattleReportId,
  adjacentBattleReportIdInSummaries,
  battleReportIdsInListOrder,
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
});
