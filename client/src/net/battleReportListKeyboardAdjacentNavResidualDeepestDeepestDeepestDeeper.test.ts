import { afterEach, describe, expect, it, vi } from "vitest";
import {
  battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperIndex,
  pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperRing,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS,
  resetBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperRingTimersForTests,
} from "@/net/battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeper";

describe("battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeper (CLIENT-366)", () => {
  afterEach(() => {
    resetBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperRingTimersForTests();
  });

  it("battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperIndex steps within filtered order", () => {
    const ids = [10, 8, 5];
    expect(
      battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperIndex(ids, 8, "prev"),
    ).toBe(0);
    expect(
      battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperIndex(ids, 8, "next"),
    ).toBe(2);
    expect(
      battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperIndex(ids, 10, "prev"),
    ).toBeNull();
    expect(
      battleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperIndex(ids, 5, "next"),
    ).toBeNull();
  });

  it("pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperRing toggles class for 2.5s", () => {
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
      pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperRing(ul, 8, windowObj),
    ).toBe(true);
    expect(
      li.classList.contains(
        REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
      ),
    ).toBe(true);
    expect(timeouts[0]?.ms).toBe(
      REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS,
    );
    timeouts[0]?.fn();
    expect(
      li.classList.contains(
        REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
      ),
    ).toBe(false);
  });

  it("pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperRing returns false when row missing", () => {
    const ul = document.createElement("ul");
    expect(
      pulseBattleReportListKeyboardAdjacentNavResidualDeepestDeepestDeepestDeeperRing(
        ul,
        99,
        globalThis.window,
      ),
    ).toBe(false);
  });
});
