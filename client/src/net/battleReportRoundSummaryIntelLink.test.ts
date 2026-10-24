import { describe, expect, it } from "vitest";
import {
  canOfferRoundSummaryIntelLink,
  OPEN_INTEL_FOR_REPORT_ACTION,
  REPORT_ROUND_SUMMARY_INTEL_LINK_CLASS,
  resolveMarchIdForBattleReport,
} from "@/net/battleReportRoundSummaryIntelLink";

describe("battleReportRoundSummaryIntelLink (CLIENT-224)", () => {
  it("exports link DOM contract constants", () => {
    expect(REPORT_ROUND_SUMMARY_INTEL_LINK_CLASS).toBe("report-round-summary-intel-link");
    expect(OPEN_INTEL_FOR_REPORT_ACTION).toBe("open-intel-for-report");
  });

  it("resolveMarchIdForBattleReport prefers march linked by report_id", () => {
    const marches = [
      { march_id: 1, report_id: 99, to_x: 1, to_y: 1, arrive_at_ms: 50 },
      { march_id: 2, report_id: 99, to_x: 2, to_y: 2, arrive_at_ms: 200 },
      { march_id: 3, to_x: 5, to_y: 5, arrive_at_ms: 300 },
    ];
    expect(resolveMarchIdForBattleReport(marches, { report_id: 99, location_x: 5, location_y: 5 })).toBe(
      2,
    );
  });

  it("resolveMarchIdForBattleReport falls back to nearest dest cell by battle coords", () => {
    const marches = [
      { march_id: 10, to_x: 8, to_y: 5, arrive_at_ms: 1 },
      { march_id: 11, to_x: 5, to_y: 5, arrive_at_ms: 2 },
    ];
    expect(
      resolveMarchIdForBattleReport(marches, { report_id: 404, location_x: 5, location_y: 5 }),
    ).toBe(11);
    expect(
      resolveMarchIdForBattleReport(marches, { report_id: 404, location_x: 6, location_y: 5 }),
    ).toBe(11);
  });

  it("resolveMarchIdForBattleReport returns null without coords or marches", () => {
    expect(resolveMarchIdForBattleReport([], { report_id: 1 })).toBeNull();
    expect(resolveMarchIdForBattleReport([{ march_id: 1, to_x: 1, to_y: 1 }], {})).toBeNull();
  });

  it("canOfferRoundSummaryIntelLink mirrors resolveMarchIdForBattleReport", () => {
    const marches = [{ march_id: 1, to_x: 3, to_y: 4 }];
    expect(canOfferRoundSummaryIntelLink(marches, { location_x: 3, location_y: 4 })).toBe(true);
    expect(canOfferRoundSummaryIntelLink(marches, null)).toBe(false);
    expect(canOfferRoundSummaryIntelLink([], { location_x: 3, location_y: 4 })).toBe(false);
  });
});
