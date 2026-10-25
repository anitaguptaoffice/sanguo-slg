import { afterEach, describe, expect, it, vi } from "vitest";
import {
  battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestIndex,
  pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestRing,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_MS,
  resetBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestRingTimersForTests,
} from "@/net/battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepest";

describe("battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepest (CLIENT-350)", () => {
  afterEach(() => {
    resetBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestRingTimersForTests();
  });

  it("battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestIndex steps within filtered order", () => {
    const ids = [10, 8, 5];
    expect(battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestIndex(ids, 8, "prev")).toBe(
      0,
    );
    expect(battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestIndex(ids, 8, "next")).toBe(
      2,
    );
    expect(
      battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestIndex(ids, 10, "prev"),
    ).toBeNull();
    expect(
      battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestIndex(ids, 5, "next"),
    ).toBeNull();
  });

  it("pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestRing toggles class for 2.5s", () => {
    const ul = document.createElement("ul");
    const li = document.createElement("li");
    li.setAttribute("data-report-id", "8");
    ul.appendChild(li);
    const timeouts: Array<{ fn: () => void; ms: number }> = [];
    const windowObj = {
      setTimeout: (fn: () => void, ms?: number) => {
        timeouts.push({ fn, ms: ms ?? 0 });
        return timeouts.length;
      },
      clearTimeout: vi.fn(),
    };
    expect(
      pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestRing(ul, 8, windowObj),
    ).toBe(true);
    expect(li.classList.contains(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS)).toBe(
      true,
    );
    expect(timeouts[0]?.ms).toBe(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_MS);
    timeouts[0]?.fn();
    expect(li.classList.contains(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS)).toBe(
      false,
    );
  });

  it("pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestRing returns false when row missing", () => {
    const ul = document.createElement("ul");
    expect(
      pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestRing(
        ul,
        99,
        globalThis.window,
      ),
    ).toBe(false);
  });
});
