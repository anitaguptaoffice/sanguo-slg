import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyBattleReportCoordCopyBarResidualDeepestSweep,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_SWEEP_CLASS,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_SWEEP_MS,
  formatBattleReportCoordCopyBarResidualDeepestSweep,
  resetBattleReportCoordCopyBarResidualDeepestSweepTimersForTests,
} from "@/net/battleReportCoordCopyBarResidualDeepestSweep";

describe("battleReportCoordCopyBarResidualDeepestSweep (CLIENT-302)", () => {
  afterEach(() => {
    resetBattleReportCoordCopyBarResidualDeepestSweepTimersForTests();
  });

  it("formatBattleReportCoordCopyBarResidualDeepestSweep builds readonly deepest sweep hint", () => {
    expect(formatBattleReportCoordCopyBarResidualDeepestSweep("8,9")).toContain("8,9");
    expect(formatBattleReportCoordCopyBarResidualDeepestSweep("8,9")).toContain("2.5s");
    expect(formatBattleReportCoordCopyBarResidualDeepestSweep("")).toBe("");
  });

  it("applyBattleReportCoordCopyBarResidualDeepestSweep adds deepest sweep class for 2.5s", () => {
    const bar = document.createElement("button");
    bar.className = "battle-report-coord-copy-bar";
    const timeouts: Array<{ fn: () => void; ms: number }> = [];
    const windowObj = {
      setTimeout: (fn: () => void, ms?: number) => {
        timeouts.push({ fn, ms: ms ?? 0 });
        return timeouts.length;
      },
      clearTimeout: vi.fn(),
    };
    applyBattleReportCoordCopyBarResidualDeepestSweep(bar, undefined, windowObj);
    expect(bar.classList.contains(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_SWEEP_CLASS)).toBe(
      true,
    );
    expect(timeouts[0]?.ms).toBe(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_SWEEP_MS);
    timeouts[0]?.fn();
    expect(bar.classList.contains(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_SWEEP_CLASS)).toBe(
      false,
    );
  });
});
