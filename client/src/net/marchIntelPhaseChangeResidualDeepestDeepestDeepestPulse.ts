import { INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS } from "@/net/marchIntelPhaseChangeResidualDeepestDeepestDeeperPulse";

/** CLIENT-354：军情 phase 变更残余 **巩固再加深四层**扫读脉冲（与 CLIENT-338 三层脉冲 **并存**）。 */
export const INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS =
  "intel-phase-change-residual-deepest-deepest-deepest-pulse";
export const INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_MS = 2000;

let deepestDeepestDeepestPulseTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

export function clearIntelPhaseChangeResidualDeepestDeepestDeepestPulse(
  el: HTMLElement | null | undefined,
): void {
  if (!el) return;
  const prev = deepestDeepestDeepestPulseTimers.get(el);
  if (prev != null) {
    clearTimeout(prev);
    deepestDeepestDeepestPulseTimers.delete(el);
  }
  el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS);
}

export function scheduleIntelPhaseChangeResidualDeepestDeepestDeepestPulse(
  el: HTMLElement | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_MS,
): void {
  if (!el) return;
  const prev = deepestDeepestDeepestPulseTimers.get(el);
  if (prev != null) {
    windowObj.clearTimeout(prev);
    deepestDeepestDeepestPulseTimers.delete(el);
  }
  el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS);
  void el.offsetWidth;
  el.classList.add(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS);
  const timer = windowObj.setTimeout(() => {
    el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS);
    deepestDeepestDeepestPulseTimers.delete(el);
  }, durationMs);
  deepestDeepestDeepestPulseTimers.set(el, timer);
}

export function resetIntelPhaseChangeResidualDeepestDeepestDeepestPulseTimersForTests(): void {
  deepestDeepestDeepestPulseTimers = new WeakMap();
}

/** 巩固再加深四层脉冲时长须覆盖 CLIENT-338 三层脉冲，避免更深环先摘后三层脉冲仍亮造成误读。 */
export function intelPhaseChangeResidualDeepestDeepestDeepestPulseCoversDeepestDeepestDeeperMs(): boolean {
  return (
    INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_MS >=
    INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS
  );
}
