import type { MarchSummary } from "@/net/militaryFormat";
import { detectMarchPhaseChanges } from "@/net/marchPhaseListRefresh";

/** CLIENT-221：军情列表行 / 信息卡阶段条 phase 变更同步脉冲。 */
export const INTEL_PHASE_CHANGE_FLASH_CLASS = "intel-phase-change-flash";
export const INTEL_PHASE_CHANGE_FLASH_MS = 2000;

/**
 * `ListMarches` 相邻快照间 phase 变化的 `march_id`（不含新出现行军；与 CLIENT-141 同源）。
 */
export function detectMarchPhaseChange(
  previous: readonly MarchSummary[],
  next: readonly MarchSummary[],
): number[] {
  return detectMarchPhaseChanges(previous, next);
}

export function scheduleIntelPhaseChangeFlash(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.classList.remove(INTEL_PHASE_CHANGE_FLASH_CLASS);
  void el.offsetWidth;
  el.classList.add(INTEL_PHASE_CHANGE_FLASH_CLASS);
  window.setTimeout(
    () => el.classList.remove(INTEL_PHASE_CHANGE_FLASH_CLASS),
    INTEL_PHASE_CHANGE_FLASH_MS,
  );
}
