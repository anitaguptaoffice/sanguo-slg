import { afterEach, describe, expect, it, vi } from "vitest";
import {
  battleReportListKeyboardAdjacentNavResidualDeepestDeeperIndex,
  pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeeperRing,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPER_RING_CLASS,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPER_RING_MS,
  resetBattleReportListKeyboardAdjacentNavResidualDeepestDeeperRingTimersForTests,
} from "@/net/battleReportListKeyboardAdjacentNavResidualDeepestDeeper";

describe("battleReportListKeyboardAdjacentNavResidualDeepestDeeper (CLIENT-318)", () => {
  afterEach(() => {
    resetBattleReportListKeyboardAdjacentNavResidualDeepestDeeperRingTimersForTests();
  });

  it("battleReportListKeyboardAdjacentNavResidualDeepestDeeperIndex steps within filtered order", () => {
    const ids = [10, 8, 5];
    expect(battleReportListKeyboardAdjacentNavResidualDeepestDeeperIndex(ids, 8, "prev")).toBe(0);
    expect(battleReportListKeyboardAdjacentNavResidualDeepestDeeperIndex(ids, 8, "next")).toBe(2);
    expect(battleReportListKeyboardAdjacentNavResidualDeepestDeeperIndex(ids, 10, "prev")).toBeNull();
    expect(battleReportListKeyboardAdjacentNavResidualDeepestDeeperIndex(ids, 5, "next")).toBeNull();
  });

  it("pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeeperRing toggles class for 2.5s", () => {
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
    expect(
      pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeeperRing(ul, 8, windowObj),
    ).toBe(true);
    expect(
      row.classList.contains(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPER_RING_CLASS),
    ).toBe(true);
    expect(timeouts[0]?.ms).toBe(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPER_RING_MS);
    timeouts[0]?.fn();
    expect(
      row.classList.contains(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPER_RING_CLASS),
    ).toBe(false);
    expect(
      pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeeperRing(
        document.createElement("ul"),
        99,
      ),
    ).toBe(false);
  });
});
