import { beforeEach, describe, expect, it } from "vitest";
import {
  REPORT_OUTCOME_FILTER_BRIDGE_SESSION_KEY,
  consumePendingOutcomeFilterBridge,
  inferBattleReportOutcomeFilterFromMail,
  parseReportOutcomeFilterBridge,
  serializeReportOutcomeFilterBridge,
  stageReportOutcomeFilterBridgeFromMail,
  takeMailReturnFromReportBridge,
} from "@/net/reportOutcomeFilterBridge";

describe("reportOutcomeFilterBridge (CLIENT-225)", () => {
  beforeEach(() => {
    sessionStorage.removeItem(REPORT_OUTCOME_FILTER_BRIDGE_SESSION_KEY);
  });

  it("serializes and parses bridge payload", () => {
    const raw = serializeReportOutcomeFilterBridge({
      pendingOutcomeFilter: "win",
      mailReturn: { categoryTab: "battle", inboxFilter: 1, selectedMailId: 42 },
    });
    expect(parseReportOutcomeFilterBridge(raw)).toEqual({
      pendingOutcomeFilter: "win",
      mailReturn: { categoryTab: "battle", inboxFilter: 1, selectedMailId: 42 },
    });
  });

  it("infers outcome filter from mail text", () => {
    expect(inferBattleReportOutcomeFilterFromMail("攻胜通知", "report_id=1")).toBe("win");
    expect(inferBattleReportOutcomeFilterFromMail("战报", "战败 report_id=2")).toBe("loss");
    expect(inferBattleReportOutcomeFilterFromMail("系统", "维护")).toBeNull();
  });

  it("consumes pending outcome while retaining mail return until mail panel takes it", () => {
    stageReportOutcomeFilterBridgeFromMail({
      title: "战报",
      body: "攻胜 report_id=7",
      categoryTab: "battle",
      inboxFilter: 0,
      selectedMailId: 7,
    });
    expect(consumePendingOutcomeFilterBridge()).toBe("win");
    expect(consumePendingOutcomeFilterBridge()).toBeNull();
    expect(takeMailReturnFromReportBridge()).toEqual({
      categoryTab: "battle",
      inboxFilter: 0,
      selectedMailId: 7,
    });
    expect(sessionStorage.getItem(REPORT_OUTCOME_FILTER_BRIDGE_SESSION_KEY)).toBeNull();
  });
});
