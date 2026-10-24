import { describe, expect, it, beforeEach } from "vitest";
import {
  BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY,
  BATTLE_REPORT_TIME_WINDOW_FILTER_SESSION_KEY,
  LEGACY_BATTLE_REPORT_TIME_WINDOW_FILTER_SESSION_KEY,
  battleReportAllLoadedLabel,
  deserializeBattleReportTimeFilter,
  hasMoreBattleReports,
  parseBattleReportOutcomeFilterSessionValue,
  parseBattleReportTimeWindowFilterSessionValue,
  readBattleReportOutcomeFilterSession,
  readBattleReportTimeWindowFilterSession,
  serializeBattleReportTimeFilter,
  writeBattleReportOutcomeFilterSession,
  writeBattleReportTimeWindowFilterSession,
} from "@/net/battleReportListState";

function mockStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

describe("battleReportListState", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = mockStorage();
  });

  it("hasMoreBattleReports compares loaded count to total", () => {
    expect(hasMoreBattleReports(0, 5)).toBe(true);
    expect(hasMoreBattleReports(4, 5)).toBe(true);
    expect(hasMoreBattleReports(5, 5)).toBe(false);
    expect(hasMoreBattleReports(6, 5)).toBe(false);
    expect(hasMoreBattleReports(1, 0)).toBe(false);
    expect(hasMoreBattleReports(-1, 10)).toBe(false);
    expect(hasMoreBattleReports(1, Number.NaN)).toBe(false);
  });

  it("battleReportAllLoadedLabel uses total count", () => {
    expect(battleReportAllLoadedLabel(12)).toBe("已加载全部 12 条");
    expect(battleReportAllLoadedLabel(12.9)).toBe("已加载全部 12 条");
  });

  it("persists outcome filter in sessionStorage battle-report-outcome-filter-v1", () => {
    writeBattleReportOutcomeFilterSession("win", storage);
    expect(storage.getItem(BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY)).toBe("win");
    expect(readBattleReportOutcomeFilterSession(storage)).toBe("win");
  });

  it("migrates legacy rxsg outcome filter key on read", () => {
    storage.setItem("rxsg.client.battleReport.outcomeFilter", "loss");
    expect(readBattleReportOutcomeFilterSession(storage)).toBe("loss");
    expect(storage.getItem(BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY)).toBe("loss");
    expect(storage.getItem("rxsg.client.battleReport.outcomeFilter")).toBeNull();
  });

  it("parseBattleReportOutcomeFilterSessionValue rejects unknown values", () => {
    expect(parseBattleReportOutcomeFilterSessionValue(null)).toBeNull();
    expect(parseBattleReportOutcomeFilterSessionValue("")).toBeNull();
    expect(parseBattleReportOutcomeFilterSessionValue("victory")).toBeNull();
    expect(parseBattleReportOutcomeFilterSessionValue("draw")).toBe("draw");
  });

  it("serializeBattleReportTimeFilter round-trips via deserialize", () => {
    expect(serializeBattleReportTimeFilter("last7d")).toBe("last7d");
    expect(deserializeBattleReportTimeFilter(serializeBattleReportTimeFilter("today"))).toBe(
      "today",
    );
    expect(deserializeBattleReportTimeFilter("invalid")).toBeNull();
  });

  it("persists time window filter in battle-report-time-filter-v1", () => {
    writeBattleReportTimeWindowFilterSession("today", storage);
    expect(storage.getItem(BATTLE_REPORT_TIME_WINDOW_FILTER_SESSION_KEY)).toBe("today");
    expect(readBattleReportTimeWindowFilterSession(storage)).toBe("today");
    writeBattleReportOutcomeFilterSession("win", storage);
    expect(storage.getItem(BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY)).toBe("win");
    expect(storage.getItem(BATTLE_REPORT_TIME_WINDOW_FILTER_SESSION_KEY)).toBe("today");
  });

  it("migrates legacy rxsg time window key on read (CLIENT-207)", () => {
    storage.setItem(LEGACY_BATTLE_REPORT_TIME_WINDOW_FILTER_SESSION_KEY, "last7d");
    expect(readBattleReportTimeWindowFilterSession(storage)).toBe("last7d");
    expect(storage.getItem(BATTLE_REPORT_TIME_WINDOW_FILTER_SESSION_KEY)).toBe("last7d");
    expect(storage.getItem(LEGACY_BATTLE_REPORT_TIME_WINDOW_FILTER_SESSION_KEY)).toBeNull();
  });

  it("parseBattleReportTimeWindowFilterSessionValue rejects unknown values", () => {
    expect(parseBattleReportTimeWindowFilterSessionValue(null)).toBeNull();
    expect(parseBattleReportTimeWindowFilterSessionValue("week")).toBeNull();
    expect(parseBattleReportTimeWindowFilterSessionValue("last7d")).toBe("last7d");
  });
});
