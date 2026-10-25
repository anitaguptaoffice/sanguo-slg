/** CLIENT-302：复制条选中态 **巩固再加深一层**扫读环（CLIENT-286 更深扫读 **不退化**；**无**剪贴板 API）。 */
export const BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_SWEEP_CLASS =
  "battle-report-coord-copy-bar-residual-deepest-sweep";

export const BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_SWEEP_MS = 2500;

let coordCopyBarDeepestSweepTimer: ReturnType<typeof setTimeout> | null = null;

/** 坐标复制条选中巩固再加深一层扫读提示（只读；**无** navigator.clipboard）。 */
export function formatBattleReportCoordCopyBarResidualDeepestSweep(copyText: string): string {
  const trimmed = copyText.trim();
  if (!trimmed) return "";
  return `坐标 ${trimmed} 只读选中巩固再加深一层扫读 2.5s`;
}

/**
 * 复制条根节点附加 `battle-report-coord-copy-bar-residual-deepest-sweep` 2.5s（与 CLIENT-254/270/286 sweep 并存）。
 */
export function applyBattleReportCoordCopyBarResidualDeepestSweep(
  barEl: HTMLElement,
  durationMs: number = BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_SWEEP_MS,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  barEl.classList.remove(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_SWEEP_CLASS);
  void barEl.offsetWidth;
  barEl.classList.add(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_SWEEP_CLASS);
  if (coordCopyBarDeepestSweepTimer != null) {
    windowObj.clearTimeout(coordCopyBarDeepestSweepTimer);
  }
  coordCopyBarDeepestSweepTimer = windowObj.setTimeout(() => {
    barEl.classList.remove(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_SWEEP_CLASS);
    coordCopyBarDeepestSweepTimer = null;
  }, durationMs);
}

/** @internal vitest */
export function resetBattleReportCoordCopyBarResidualDeepestSweepTimersForTests(): void {
  if (coordCopyBarDeepestSweepTimer != null) {
    clearTimeout(coordCopyBarDeepestSweepTimer);
    coordCopyBarDeepestSweepTimer = null;
  }
}
