/** CLIENT-350：复制条选中态 **巩固再加深四层**扫读环（CLIENT-334 更深三层扫读 **不退化**；**无**剪贴板 API）。 */
export const BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS =
  "battle-report-coord-copy-bar-residual-deepest-deepest-deepest-sweep";

export const BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_MS = 2500;

let coordCopyBarDeepestDeepestDeepestSweepTimer: ReturnType<typeof setTimeout> | null = null;

/** 坐标复制条选中巩固再加深四层扫读提示（只读；**无** navigator.clipboard）。 */
export function formatBattleReportCoordCopyBarResidualDeepestDeepestDeepestSweep(
  copyText: string,
): string {
  const trimmed = copyText.trim();
  if (!trimmed) return "";
  return `坐标 ${trimmed} 只读选中巩固再加深四层扫读 2.5s`;
}

/**
 * 复制条根节点附加 `battle-report-coord-copy-bar-residual-deepest-deepest-deepest-sweep` 2.5s（与 CLIENT-254/270/286/302/318/334 sweep 并存）。
 */
export function applyBattleReportCoordCopyBarResidualDeepestDeepestDeepestSweep(
  barEl: HTMLElement,
  durationMs: number = BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_MS,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  barEl.classList.remove(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS);
  void barEl.offsetWidth;
  barEl.classList.add(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS);
  if (coordCopyBarDeepestDeepestDeepestSweepTimer != null) {
    windowObj.clearTimeout(coordCopyBarDeepestDeepestDeepestSweepTimer);
  }
  coordCopyBarDeepestDeepestDeepestSweepTimer = windowObj.setTimeout(() => {
    barEl.classList.remove(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS);
    coordCopyBarDeepestDeepestDeepestSweepTimer = null;
  }, durationMs);
}

/** @internal vitest */
export function resetBattleReportCoordCopyBarResidualDeepestDeepestDeepestSweepTimersForTests(): void {
  if (coordCopyBarDeepestDeepestDeepestSweepTimer != null) {
    clearTimeout(coordCopyBarDeepestDeepestDeepestSweepTimer);
    coordCopyBarDeepestDeepestDeepestSweepTimer = null;
  }
}
