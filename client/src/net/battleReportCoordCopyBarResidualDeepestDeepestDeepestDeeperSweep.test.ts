import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyBattleReportCoordCopyBarResidualDeepestDeepestDeepestDeeperSweep,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_MS,
  formatBattleReportCoordCopyBarResidualDeepestDeepestDeepestDeeperSweep,
  resetBattleReportCoordCopyBarResidualDeepestDeepestDeepestDeeperSweepTimersForTests,
} from "@/net/battleReportCoordCopyBarResidualDeepestDeepestDeepestDeeperSweep";

describe("battleReportCoordCopyBarResidualDeepestDeepestDeepestDeeperSweep (CLIENT-366)", () => {
  afterEach(() => {
    resetBattleReportCoordCopyBarResidualDeepestDeepestDeepestDeeperSweepTimersForTests();
  });

  it("formatBattleReportCoordCopyBarResidualDeepestDeepestDeepestDeeperSweep builds readonly deepest-deepest-deepest-deeper sweep hint", () => {
    expect(formatBattleReportCoordCopyBarResidualDeepestDeepestDeepestDeeperSweep("8,9")).toContain(
      "8,9",
    );
    expect(formatBattleReportCoordCopyBarResidualDeepestDeepestDeepestDeeperSweep("8,9")).toContain(
      "2.5s",
    );
    expect(formatBattleReportCoordCopyBarResidualDeepestDeepestDeepestDeeperSweep("8,9")).toContain(
      "巩固再加深五层",
    );
    expect(formatBattleReportCoordCopyBarResidualDeepestDeepestDeepestDeeperSweep("")).toBe("");
  });

  it("applyBattleReportCoordCopyBarResidualDeepestDeepestDeepestDeeperSweep adds deepest-deepest-deepest-deeper sweep class for 2.5s", () => {
    const bar = document.createElement("button");
    const timeouts: Array<{ fn: () => void; ms: number }> = [];
    const windowObj = {
      setTimeout: (fn: () => void, ms?: number) => {
        timeouts.push({ fn, ms: ms ?? 0 });
        return timeouts.length;
      },
      clearTimeout: vi.fn(),
    };
    applyBattleReportCoordCopyBarResidualDeepestDeepestDeepestDeeperSweep(bar, undefined, windowObj);
    expect(
      bar.classList.contains(
        BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
      ),
    ).toBe(true);
    expect(timeouts[0]?.ms).toBe(
      BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_MS,
    );
    timeouts[0]?.fn();
    expect(
      bar.classList.contains(
        BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
      ),
    ).toBe(false);
  });
});
