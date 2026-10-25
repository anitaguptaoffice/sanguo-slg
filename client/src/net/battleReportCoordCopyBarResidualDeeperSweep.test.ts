import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyBattleReportCoordCopyBarResidualDeeperSweep,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPER_SWEEP_CLASS,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPER_SWEEP_MS,
  formatBattleReportCoordCopyBarResidualDeeperSweep,
  resetBattleReportCoordCopyBarResidualDeeperSweepTimersForTests,
} from "@/net/battleReportCoordCopyBarResidualDeeperSweep";

describe("battleReportCoordCopyBarResidualDeeperSweep (CLIENT-286)", () => {
  afterEach(() => {
    resetBattleReportCoordCopyBarResidualDeeperSweepTimersForTests();
  });

  it("formatBattleReportCoordCopyBarResidualDeeperSweep builds readonly deeper sweep hint", () => {
    expect(formatBattleReportCoordCopyBarResidualDeeperSweep("8,9")).toContain("8,9");
    expect(formatBattleReportCoordCopyBarResidualDeeperSweep("8,9")).toContain("2.5s");
    expect(formatBattleReportCoordCopyBarResidualDeeperSweep("")).toBe("");
  });

  it("applyBattleReportCoordCopyBarResidualDeeperSweep adds deeper sweep class for 2.5s", () => {
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
    applyBattleReportCoordCopyBarResidualDeeperSweep(bar, undefined, windowObj);
    expect(bar.classList.contains(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPER_SWEEP_CLASS)).toBe(
      true,
    );
    expect(timeouts[0]?.ms).toBe(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPER_SWEEP_MS);
    timeouts[0]?.fn();
    expect(bar.classList.contains(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPER_SWEEP_CLASS)).toBe(
      false,
    );
  });
});
