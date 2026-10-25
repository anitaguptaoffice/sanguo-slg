/** CLIENT-366：复制条选中态 **巩固再加深五层**扫读环（CLIENT-350 四层扫读 **不退化**；**无**剪贴板 API）。 */
export const BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS =
  "battle-report-coord-copy-bar-residual-deepest-deepest-deepest-deeper-sweep";

export const BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_MS = 2500;

let coordCopyBarDeepestDeepestDeepestDeeperSweepTimer: ReturnType<typeof setTimeout> | null = null;

/** 坐标复制条选中巩固再加深五层扫读提示（只读；**无** navigator.clipboard）。 */
export function formatBattleReportCoordCopyBarResidualDeepestDeepestDeepestDeeperSweep(
  copyText: string,
): string {
  const trimmed = copyText.trim();
  if (!trimmed) return "";
  return `坐标 ${trimmed} 只读选中巩固再加深五层扫读 2.5s`;
}

/**
 * 复制条根节点附加 `battle-report-coord-copy-bar-residual-deepest-deepest-deepest-deeper-sweep` 2.5s（与 CLIENT-254/270/286/302/318/334/350 sweep 并存）。
 */
export function applyBattleReportCoordCopyBarResidualDeepestDeepestDeepestDeeperSweep(
  barEl: HTMLElement,
  durationMs: number = BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_MS,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  barEl.classList.remove(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS);
  void barEl.offsetWidth;
  barEl.classList.add(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS);
  if (coordCopyBarDeepestDeepestDeepestDeeperSweepTimer != null) {
    windowObj.clearTimeout(coordCopyBarDeepestDeepestDeepestDeeperSweepTimer);
  }
  coordCopyBarDeepestDeepestDeepestDeeperSweepTimer = windowObj.setTimeout(() => {
    barEl.classList.remove(
      BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
    );
    coordCopyBarDeepestDeepestDeepestDeeperSweepTimer = null;
  }, durationMs);
}

/** @internal vitest */
export function resetBattleReportCoordCopyBarResidualDeepestDeepestDeepestDeeperSweepTimersForTests(): void {
  if (coordCopyBarDeepestDeepestDeepestDeeperSweepTimer != null) {
    clearTimeout(coordCopyBarDeepestDeepestDeepestDeeperSweepTimer);
    coordCopyBarDeepestDeepestDeepestDeeperSweepTimer = null;
  }
}
