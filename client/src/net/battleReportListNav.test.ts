import { describe, expect, it } from "vitest";
import {
  adjacentBattleReportId,
  battleReportIdsInListOrder,
} from "@/net/battleReportListNav";

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
});
