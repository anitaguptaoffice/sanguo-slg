import { describe, expect, it, beforeEach } from "vitest";
import {
  BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY,
  battleReportAllLoadedLabel,
  hasMoreBattleReports,
  parseBattleReportOutcomeFilterSessionValue,
  readBattleReportOutcomeFilterSession,
  writeBattleReportOutcomeFilterSession,
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

  it("persists outcome filter in sessionStorage", () => {
    writeBattleReportOutcomeFilterSession("win", storage);
    expect(storage.getItem(BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY)).toBe("win");
    expect(readBattleReportOutcomeFilterSession(storage)).toBe("win");
  });

  it("parseBattleReportOutcomeFilterSessionValue rejects unknown values", () => {
    expect(parseBattleReportOutcomeFilterSessionValue(null)).toBeNull();
    expect(parseBattleReportOutcomeFilterSessionValue("")).toBeNull();
    expect(parseBattleReportOutcomeFilterSessionValue("victory")).toBeNull();
    expect(parseBattleReportOutcomeFilterSessionValue("draw")).toBe("draw");
  });
});
