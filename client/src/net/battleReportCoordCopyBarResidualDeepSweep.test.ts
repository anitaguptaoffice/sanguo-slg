import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyBattleReportCoordCopyBarResidualDeepSweep,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_CLASS,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_MS,
  formatBattleReportCoordCopyBarResidualDeepSweep,
  resetBattleReportCoordCopyBarResidualDeepSweepTimersForTests,
} from "@/net/battleReportCoordCopyBarResidualDeepSweep";

describe("battleReportCoordCopyBarResidualDeepSweep (CLIENT-270)", () => {
  afterEach(() => {
    resetBattleReportCoordCopyBarResidualDeepSweepTimersForTests();
  });

  it("formatBattleReportCoordCopyBarResidualDeepSweep builds readonly deep sweep hint", () => {
    expect(formatBattleReportCoordCopyBarResidualDeepSweep("8,9")).toContain("8,9");
    expect(formatBattleReportCoordCopyBarResidualDeepSweep("8,9")).toContain("2.5s");
    expect(formatBattleReportCoordCopyBarResidualDeepSweep("")).toBe("");
  });

  it("applyBattleReportCoordCopyBarResidualDeepSweep adds deep sweep class for 2.5s", () => {
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
    applyBattleReportCoordCopyBarResidualDeepSweep(bar, undefined, windowObj);
    expect(bar.classList.contains(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_CLASS)).toBe(
      true,
    );
    expect(timeouts[0]?.ms).toBe(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_MS);
    timeouts[0]?.fn();
    expect(bar.classList.contains(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_CLASS)).toBe(
      false,
    );
  });
});
