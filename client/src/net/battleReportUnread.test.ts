// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BattleReportUnreadSession,
  countUnreadReportIds,
} from "@/net/battleReportUnread";

describe("BattleReportUnreadSession", () => {
  it("counts ids not in baseline until panel opened", () => {
    const session = new BattleReportUnreadSession();
    expect(session.countUnread([{ report_id: 1 }, { report_id: 2 }])).toBe(2);
    session.markPanelOpened([{ report_id: 1 }, { report_id: 2 }]);
    expect(session.countUnread([{ report_id: 1 }, { report_id: 2 }])).toBe(0);
    expect(session.countUnread([{ report_id: 1 }, { report_id: 3 }])).toBe(1);
  });
});

describe("countUnreadReportIds", () => {
  it("skips invalid ids", () => {
    expect(countUnreadReportIds([0, -1, 5], new Set())).toBe(1);
  });
});
