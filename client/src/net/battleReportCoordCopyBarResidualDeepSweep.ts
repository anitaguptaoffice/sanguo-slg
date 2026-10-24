/** CLIENT-270：复制条选中态 **加深**扫读环（CLIENT-254 2s 环 **不退化**；**无**剪贴板 API）。 */
export const BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_CLASS =
  "battle-report-coord-copy-bar-residual-deep-sweep";

export const BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_MS = 2500;

let coordCopyBarDeepSweepTimer: ReturnType<typeof setTimeout> | null = null;

/** 坐标复制条选中深扫读提示（只读；**无** navigator.clipboard）。 */
export function formatBattleReportCoordCopyBarResidualDeepSweep(copyText: string): string {
  const trimmed = copyText.trim();
  if (!trimmed) return "";
  return `坐标 ${trimmed} 只读选中深扫读 2.5s`;
}

/**
 * 复制条根节点附加 `battle-report-coord-copy-bar-residual-deep-sweep` 2.5s（与 CLIENT-254 sweep 并存）。
 */
export function applyBattleReportCoordCopyBarResidualDeepSweep(
  barEl: HTMLElement,
  durationMs: number = BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_MS,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): void {
  barEl.classList.remove(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_CLASS);
  void barEl.offsetWidth;
  barEl.classList.add(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_CLASS);
  if (coordCopyBarDeepSweepTimer != null) {
    windowObj.clearTimeout(coordCopyBarDeepSweepTimer);
  }
  coordCopyBarDeepSweepTimer = windowObj.setTimeout(() => {
    barEl.classList.remove(BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_CLASS);
    coordCopyBarDeepSweepTimer = null;
  }, durationMs);
}

/** @internal vitest */
export function resetBattleReportCoordCopyBarResidualDeepSweepTimersForTests(): void {
  if (coordCopyBarDeepSweepTimer != null) {
    clearTimeout(coordCopyBarDeepSweepTimer);
    coordCopyBarDeepSweepTimer = null;
  }
}
