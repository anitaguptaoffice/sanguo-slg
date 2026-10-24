import { afterEach, describe, expect, it, vi } from "vitest";
import {
  battleReportListKeyboardAdjacentNavIndex,
  pulseBattleReportListKeyboardAdjacentNavResidualRing,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_CLASS,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_MS,
  resetBattleReportListKeyboardAdjacentNavResidualRingTimersForTests,
} from "@/net/battleReportListKeyboardAdjacentNavResidual";

describe("battleReportListKeyboardAdjacentNavResidual (CLIENT-254)", () => {
  afterEach(() => {
    resetBattleReportListKeyboardAdjacentNavResidualRingTimersForTests();
  });

  it("battleReportListKeyboardAdjacentNavIndex steps within filtered order", () => {
    const ids = [10, 8, 5];
    expect(battleReportListKeyboardAdjacentNavIndex(ids, 8, "prev")).toBe(0);
    expect(battleReportListKeyboardAdjacentNavIndex(ids, 8, "next")).toBe(2);
    expect(battleReportListKeyboardAdjacentNavIndex(ids, 10, "prev")).toBeNull();
    expect(battleReportListKeyboardAdjacentNavIndex(ids, 5, "next")).toBeNull();
  });

  it("pulseBattleReportListKeyboardAdjacentNavResidualRing toggles class for 2s", () => {
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

    expect(pulseBattleReportListKeyboardAdjacentNavResidualRing(ul, 8, windowObj)).toBe(true);
    expect(row.classList.contains(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_CLASS)).toBe(
      true,
    );
    expect(timeouts[0]?.ms).toBe(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_MS);
    timeouts[0]?.fn();
    expect(row.classList.contains(REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_CLASS)).toBe(
      false,
    );
  });

  it("returns false when row missing", () => {
    expect(
      pulseBattleReportListKeyboardAdjacentNavResidualRing(document.createElement("ul"), 99),
    ).toBe(false);
  });
});
