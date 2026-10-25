import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyBattleReportCoordCopyBarResidualDeepestDeeperSweep,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPER_SWEEP_MS,
  formatBattleReportCoordCopyBarResidualDeepestDeeperSweep,
  resetBattleReportCoordCopyBarResidualDeepestDeeperSweepTimersForTests,
} from "@/net/battleReportCoordCopyBarResidualDeepestDeeperSweep";

describe("battleReportCoordCopyBarResidualDeepestDeeperSweep (CLIENT-318)", () => {
  afterEach(() => {
    resetBattleReportCoordCopyBarResidualDeepestDeeperSweepTimersForTests();
  });

  it("formatBattleReportCoordCopyBarResidualDeepestDeeperSweep builds readonly deepest-deeper sweep hint", () => {
    expect(formatBattleReportCoordCopyBarResidualDeepestDeeperSweep("8,9")).toContain("8,9");
    expect(formatBattleReportCoordCopyBarResidualDeepestDeeperSweep("8,9")).toContain("2.5s");
    expect(formatBattleReportCoordCopyBarResidualDeepestDeeperSweep("8,9")).toContain("巩固再加深二层");
    expect(formatBattleReportCoordCopyBarResidualDeepestDeeperSweep("")).toBe("");
  });

  it("applyBattleReportCoordCopyBarResidualDeepestDeeperSweep adds deepest-deeper sweep class for 2.5s", () => {
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
    applyBattleReportCoordCopyBarResidualDeepestDeeperSweep(bar, undefined, windowObj);
    expect(bar.classList.contains(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS)).toBe(
      true,
    );
    expect(timeouts[0]?.ms).toBe(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPER_SWEEP_MS);
    timeouts[0]?.fn();
    expect(bar.classList.contains(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS)).toBe(
      false,
    );
  });
});
