import { afterEach, describe, expect, it, vi } from "vitest";
import {
  battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperIndex,
  pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperRing,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_MS,
  resetBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperRingTimersForTests,
} from "@/net/battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeper";

describe("battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeper (CLIENT-334)", () => {
  afterEach(() => {
    resetBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperRingTimersForTests();
  });

  it("battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperIndex steps within filtered order", () => {
    const ids = [10, 8, 5];
    expect(battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperIndex(ids, 8, "prev")).toBe(
      0,
    );
    expect(battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperIndex(ids, 8, "next")).toBe(
      2,
    );
    expect(
      battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperIndex(ids, 10, "prev"),
    ).toBeNull();
    expect(
      battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperIndex(ids, 5, "next"),
    ).toBeNull();
  });

  it("pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperRing toggles class for 2.5s", () => {
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
      pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperRing(ul, 8, windowObj),
    ).toBe(true);
    expect(
      row.classList.contains(
        REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
      ),
    ).toBe(true);
    expect(timeouts[0]?.ms).toBe(
      REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_MS,
    );
    timeouts[0]?.fn();
    expect(
      row.classList.contains(
        REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
      ),
    ).toBe(false);
    expect(
      pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeeperRing(
        document.createElement("ul"),
        99,
      ),
    ).toBe(false);
  });
});
