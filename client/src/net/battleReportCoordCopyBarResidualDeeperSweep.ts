/** CLIENT-286：复制条选中态 **巩固再加深**扫读环（CLIENT-270 深扫读 **不退化**；**无**剪贴板 API）。 */
export const BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPER_SWEEP_CLASS =
  "battle-report-coord-copy-bar-residual-deeper-sweep";

export const BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPER_SWEEP_MS = 2500;

let coordCopyBarDeeperSweepTimer: ReturnType<typeof setTimeout> | null = null;

/** 坐标复制条选中巩固再加深扫读提示（只读；**无** navigator.clipboard）。 */
export function formatBattleReportCoordCopyBarResidualDeeperSweep(copyText: string): string {
  const trimmed = copyText.trim();
  if (!trimmed) return "";
  return `坐标 ${trimmed} 只读选中巩固再加深扫读 2.5s`;
}

/**
 * 复制条根节点附加 `battle-report-coord-copy-bar-residual-deeper-sweep` 2.5s（与 CLIENT-254/270 sweep 并存）。
 */
export function applyBattleReportCoordCopyBarResidualDeeperSweep(
  barEl: HTMLElement,
  durationMs: number = BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPER_SWEEP_MS,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  barEl.classList.remove(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPER_SWEEP_CLASS);
  void barEl.offsetWidth;
  barEl.classList.add(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPER_SWEEP_CLASS);
  if (coordCopyBarDeeperSweepTimer != null) {
    windowObj.clearTimeout(coordCopyBarDeeperSweepTimer);
  }
  coordCopyBarDeeperSweepTimer = windowObj.setTimeout(() => {
    barEl.classList.remove(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPER_SWEEP_CLASS);
    coordCopyBarDeeperSweepTimer = null;
  }, durationMs);
}

/** @internal vitest */
export function resetBattleReportCoordCopyBarResidualDeeperSweepTimersForTests(): void {
  if (coordCopyBarDeeperSweepTimer != null) {
    clearTimeout(coordCopyBarDeeperSweepTimer);
    coordCopyBarDeeperSweepTimer = null;
  }
}
