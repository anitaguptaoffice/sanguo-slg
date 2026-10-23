import { describe, expect, it } from "vitest";
import {
  MarchEndBattleReportHint,
  pickLatestBattleReportId,
  selectDeepLinkBattleReportId,
} from "@/net/battleReportDeepLink";

describe("battleReportDeepLink", () => {
  const reports = [
    { report_id: 12, created_at_ms: 100 },
    { report_id: 9, created_at_ms: 200 },
  ];

  it("picks max report_id as latest", () => {
    expect(pickLatestBattleReportId(reports)).toBe(12);
    expect(pickLatestBattleReportId([])).toBe(0);
  });

  it("selects hint when present in loaded list", () => {
    expect(selectDeepLinkBattleReportId(reports, 9)).toBe(9);
    expect(selectDeepLinkBattleReportId(reports, 99)).toBe(12);
    expect(selectDeepLinkBattleReportId(reports, null)).toBe(12);
  });

  it("stores and consumes march-end hint", () => {
    const session = new MarchEndBattleReportHint();
    session.setFromReports(reports);
    expect(session.peek()).toBe(12);
    expect(session.consume()).toBe(12);
    expect(session.peek()).toBeNull();
    session.setReportId(7);
    expect(session.consume()).toBe(7);
  });
});
