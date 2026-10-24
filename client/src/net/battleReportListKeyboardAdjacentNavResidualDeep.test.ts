import { afterEach, describe, expect, it, vi } from "vitest";
import {
  battleReportListKeyboardAdjacentNavResidualDeepIndex,
  pulseBattleReportListKeyboardAdjacentNavResidualDeepRing,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEP_RING_CLASS,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEP_RING_MS,
  resetBattleReportListKeyboardAdjacentNavResidualDeepRingTimersForTests,
} from "@/net/battleReportListKeyboardAdjacentNavResidualDeep";

describe("battleReportListKeyboardAdjacentNavResidualDeep (CLIENT-270)", () => {
  afterEach(() => {
    resetBattleReportListKeyboardAdjacentNavResidualDeepRingTimersForTests();
  });

  it("battleReportListKeyboardAdjacentNavResidualDeepIndex steps within filtered order", () => {
    const ids = [10, 8, 5];
    expect(battleReportListKeyboardAdjacentNavResidualDeepIndex(ids, 8, "prev")).toBe(0);
    expect(battleReportListKeyboardAdjacentNavResidualDeepIndex(ids, 8, "next")).toBe(2);
    expect(battleReportListKeyboardAdjacentNavResidualDeepIndex(ids, 10, "prev")).toBeNull();
    expect(battleReportListKeyboardAdjacentNavResidualDeepIndex(ids, 5, "next")).toBeNull();
  });

  it("pulseBattleReportListKeyboardAdjacentNavResidualDeepRing toggles class for 2.5s", () => {
    const ul = document.createElement("ul");
    const row = document.createElement("li");
    row.setAttribute("data-report-id", "8");
    ul.appendChild(row);

    const timeouts: Array<{ fn: () => void; ms: number }> = [];
    const windowObj = {
      setTimeout: (fn: () => void, ms?: number) => {
        timeouts.push({ fn, ms: ms ?? 0 });
        return timeouts.length;
      },
      clearTimeout: vi.fn(),
    };

    expect(pulseBattleReportListKeyboardAdjacentNavResidualDeepRing(ul, 8, windowObj)).toBe(true);
    expect(row.classList.contains(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEP_RING_CLASS)).toBe(
      true,
    );
    expect(timeouts[0]?.ms).toBe(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEP_RING_MS);
    timeouts[0]?.fn();
    expect(row.classList.contains(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEP_RING_CLASS)).toBe(
      false,
    );
  });

  it("returns false when row missing", () => {
    expect(
      pulseBattleReportListKeyboardAdjacentNavResidualDeepRing(document.createElement("ul"), 99),
    ).toBe(false);
  });
});
