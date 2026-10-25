import { afterEach, describe, expect, it, vi } from "vitest";
import { BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_CLASS } from "@/net/battleReportCoordCopyBarResidualDeepSweep";
import { BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPER_SWEEP_CLASS } from "@/net/battleReportCoordCopyBarResidualDeeperSweep";
import { BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_SWEEP_CLASS } from "@/net/battleReportCoordCopyBarResidualDeepestSweep";
import { BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS } from "@/net/battleReportCoordCopyBarResidualDeepestDeeperSweep";
import { BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS } from "@/net/battleReportCoordCopyBarResidualDeepestDeepestDeeperSweep";
import { BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS } from "@/net/battleReportCoordCopyBarResidualDeepestDeepestDeepestSweep";
import { BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS } from "@/net/battleReportCoordCopyBarResidualDeepestDeepestDeepestDeeperSweep";
import {
  applyBattleReportCoordCopyBarResidualSweep,
  applyBattleReportCoordsReadonlySelect,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_CLASS,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_MS,
  BATTLE_REPORT_COORD_COPY_SELECTED_CLASS,
  BATTLE_REPORT_COORD_COPY_SELECT_MS,
  formatBattleReportCoordCopyBarResidualSweep,
  formatBattleReportCoordsCopyText,
  formatBattleReportSideTemplateResidualLine,
  resetBattleReportCoordCopyBarResidualSweepTimersForTests,
  shouldShowBattleReportCoordCopyBar,
} from "@/net/battleReportDetailTemplateResidual";

describe("battleReportDetailTemplateResidual (CLIENT-240)", () => {
  const report = {
    summary: {
      report_id: 3,
      attacker_player_id: 1,
      defender_player_id: 2,
      attacker_display_name: "演示君主",
      attacker_hero_template_name: "吕布",
      defender_hero_template_cfg_id: 1002,
      location_x: 8,
      location_y: 9,
    },
    detail: {
      attacker_casualties: { infantry: 10 },
      defender_casualties: { cavalry: 5 },
    },
  };

  it("formatBattleReportSideTemplateResidualLine builds template + casualty subline", () => {
    const { templateLine, casualtySubline } =
      formatBattleReportSideTemplateResidualLine(report);
    expect(templateLine).toBe("攻：吕布 · 守：关羽");
    expect(casualtySubline).toContain("兵力损耗");
    expect(casualtySubline).toContain("步兵 10");
    expect(casualtySubline).toContain("骑兵 5");
  });

  it("formatBattleReportCoordsCopyText uses x,y", () => {
    expect(formatBattleReportCoordsCopyText({ x: 8, y: 9 })).toBe("8,9");
    expect(formatBattleReportCoordsCopyText(null)).toBe("");
  });

  it("shouldShowBattleReportCoordCopyBar when location fields present", () => {
    expect(shouldShowBattleReportCoordCopyBar(report.summary)).toBe(true);
    expect(shouldShowBattleReportCoordCopyBar({ report_id: 1 })).toBe(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    resetBattleReportCoordCopyBarResidualSweepTimersForTests();
  });

  it("formatBattleReportCoordCopyBarResidualSweep builds readonly sweep hint", () => {
    expect(formatBattleReportCoordCopyBarResidualSweep("8,9")).toContain("8,9");
    expect(formatBattleReportCoordCopyBarResidualSweep("8,9")).toContain("2s");
    expect(formatBattleReportCoordCopyBarResidualSweep("")).toBe("");
  });

  it("applyBattleReportCoordCopyBarResidualSweep adds sweep class for 2s", () => {
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
    applyBattleReportCoordCopyBarResidualSweep(bar, undefined, windowObj);
    expect(bar.classList.contains(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_CLASS)).toBe(true);
    expect(timeouts[0]?.ms).toBe(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_MS);
    timeouts[0]?.fn();
    expect(bar.classList.contains(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_CLASS)).toBe(false);
  });

  it("applyBattleReportCoordsReadonlySelect highlights text for 1.5s without clipboard", () => {
    vi.useFakeTimers();
    const bar = document.createElement("button");
    bar.className = "battle-report-coord-copy-bar";
    const span = document.createElement("span");
    span.textContent = "8,9";
    bar.appendChild(span);
    document.body.appendChild(bar);
    const addRange = vi.fn();
    const removeAllRanges = vi.fn();
    const getSelection = vi.spyOn(window, "getSelection").mockReturnValue({
      addRange,
      removeAllRanges,
    } as unknown as Selection);

    applyBattleReportCoordsReadonlySelect(span);
    expect(span.classList.contains(BATTLE_REPORT_COORD_COPY_SELECTED_CLASS)).toBe(true);
    expect(bar.classList.contains(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_CLASS)).toBe(true);
    expect(bar.classList.contains(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_CLASS)).toBe(
      true,
    );
    expect(bar.classList.contains(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPER_SWEEP_CLASS)).toBe(
      true,
    );
    expect(bar.classList.contains(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_SWEEP_CLASS)).toBe(
      true,
    );
    expect(
      bar.classList.contains(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS),
    ).toBe(true);
    expect(
      bar.classList.contains(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS),
    ).toBe(true);
    expect(
      bar.classList.contains(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS),
    ).toBe(true);
    expect(
      bar.classList.contains(
        BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
      ),
    ).toBe(true);
    expect(addRange).toHaveBeenCalled();
    expect(getSelection).toHaveBeenCalled();

    vi.advanceTimersByTime(BATTLE_REPORT_COORD_COPY_SELECT_MS);
    expect(span.classList.contains(BATTLE_REPORT_COORD_COPY_SELECTED_CLASS)).toBe(false);
    expect(removeAllRanges).toHaveBeenCalled();

    bar.remove();
    getSelection.mockRestore();
  });
});
