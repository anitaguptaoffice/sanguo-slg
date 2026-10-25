/** CLIENT-334：复制条选中态 **巩固再加深三层**扫读环（CLIENT-318 更深二层扫读 **不退化**；**无**剪贴板 API）。 */
export const BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS =
  "battle-report-coord-copy-bar-residual-deepest-deepest-deeper-sweep";

export const BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_MS = 2500;

let coordCopyBarDeepestDeepestDeeperSweepTimer: ReturnType<typeof setTimeout> | null = null;

/** 坐标复制条选中巩固再加深三层扫读提示（只读；**无** navigator.clipboard）。 */
export function formatBattleReportCoordCopyBarResidualDeepestDeepestDeeperSweep(
  copyText: string,
): string {
  const trimmed = copyText.trim();
  if (!trimmed) return "";
  return `坐标 ${trimmed} 只读选中巩固再加深三层扫读 2.5s`;
}

/**
 * 复制条根节点附加 `battle-report-coord-copy-bar-residual-deepest-deepest-deeper-sweep` 2.5s（与 CLIENT-254/270/286/302/318 sweep 并存）。
 */
export function applyBattleReportCoordCopyBarResidualDeepestDeepestDeeperSweep(
  barEl: HTMLElement,
  durationMs: number = BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_MS,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  barEl.classList.remove(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS);
  void barEl.offsetWidth;
  barEl.classList.add(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS);
  if (coordCopyBarDeepestDeepestDeeperSweepTimer != null) {
    windowObj.clearTimeout(coordCopyBarDeepestDeepestDeeperSweepTimer);
  }
  coordCopyBarDeepestDeepestDeeperSweepTimer = windowObj.setTimeout(() => {
    barEl.classList.remove(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS);
    coordCopyBarDeepestDeepestDeeperSweepTimer = null;
  }, durationMs);
}

/** @internal vitest */
export function resetBattleReportCoordCopyBarResidualDeepestDeepestDeeperSweepTimersForTests(): void {
  if (coordCopyBarDeepestDeepestDeeperSweepTimer != null) {
    clearTimeout(coordCopyBarDeepestDeepestDeeperSweepTimer);
    coordCopyBarDeepestDeepestDeeperSweepTimer = null;
  }
}
