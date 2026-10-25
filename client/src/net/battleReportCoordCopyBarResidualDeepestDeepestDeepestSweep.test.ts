import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyBattleReportCoordCopyBarResidualDeepestDeepestDeepestSweep,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_MS,
  formatBattleReportCoordCopyBarResidualDeepestDeepestDeepestSweep,
  resetBattleReportCoordCopyBarResidualDeepestDeepestDeepestSweepTimersForTests,
} from "@/net/battleReportCoordCopyBarResidualDeepestDeepestDeepestSweep";

describe("battleReportCoordCopyBarResidualDeepestDeepestDeepestSweep (CLIENT-350)", () => {
  afterEach(() => {
    resetBattleReportCoordCopyBarResidualDeepestDeepestDeepestSweepTimersForTests();
  });

  it("formatBattleReportCoordCopyBarResidualDeepestDeepestDeepestSweep builds readonly deepest-deepest-deepest sweep hint", () => {
    expect(formatBattleReportCoordCopyBarResidualDeepestDeepestDeepestSweep("8,9")).toContain("8,9");
    expect(formatBattleReportCoordCopyBarResidualDeepestDeepestDeepestSweep("8,9")).toContain("2.5s");
    expect(formatBattleReportCoordCopyBarResidualDeepestDeepestDeepestSweep("8,9")).toContain(
      "巩固再加深四层",
    );
    expect(formatBattleReportCoordCopyBarResidualDeepestDeepestDeepestSweep("")).toBe("");
  });

  it("applyBattleReportCoordCopyBarResidualDeepestDeepestDeepestSweep adds deepest-deepest-deepest sweep class for 2.5s", () => {
    const bar = document.createElement("button");
    const timeouts: Array<{ fn: () => void; ms: number }> = [];
    const windowObj = {
      setTimeout: (fn: () => void, ms?: number) => {
        timeouts.push({ fn, ms: ms ?? 0 });
        return timeouts.length;
      },
      clearTimeout: vi.fn(),
    };
    applyBattleReportCoordCopyBarResidualDeepestDeepestDeepestSweep(bar, undefined, windowObj);
    expect(
      bar.classList.contains(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS),
    ).toBe(true);
    expect(timeouts[0]?.ms).toBe(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_MS);
    timeouts[0]?.fn();
    expect(
      bar.classList.contains(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS),
    ).toBe(false);
  });
});
