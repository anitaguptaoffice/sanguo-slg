import { INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_MS } from "@/net/marchIntelPhaseChangeResidualDeepestDeeperPulse";

/** CLIENT-338：军情 phase 变更残余 **巩固再加深三层**扫读脉冲（与 CLIENT-322 二层脉冲 **并存**）。 */
export const INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS =
  "intel-phase-change-residual-deepest-deepest-deeper-pulse";
export const INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS = 2000;

let deepestDeepestDeeperPulseTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

export function clearIntelPhaseChangeResidualDeepestDeepestDeeperPulse(
  el: HTMLElement | null | undefined,
): void {
  if (!el) return;
  const prev = deepestDeepestDeeperPulseTimers.get(el);
  if (prev != null) {
    clearTimeout(prev);
    deepestDeepestDeeperPulseTimers.delete(el);
  }
  el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS);
}

export function scheduleIntelPhaseChangeResidualDeepestDeepestDeeperPulse(
  el: HTMLElement | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS,
): void {
  if (!el) return;
  const prev = deepestDeepestDeeperPulseTimers.get(el);
  if (prev != null) {
    windowObj.clearTimeout(prev);
    deepestDeepestDeeperPulseTimers.delete(el);
  }
  el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS);
  void el.offsetWidth;
  el.classList.add(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS);
  const timer = windowObj.setTimeout(() => {
    el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS);
    deepestDeepestDeeperPulseTimers.delete(el);
  }, durationMs);
  deepestDeepestDeeperPulseTimers.set(el, timer);
}

export function resetIntelPhaseChangeResidualDeepestDeepestDeeperPulseTimersForTests(): void {
  deepestDeepestDeeperPulseTimers = new WeakMap();
}

/** 巩固再加深三层脉冲时长须覆盖 CLIENT-322 二层脉冲，避免更深环先摘后二层脉冲仍亮造成误读。 */
export function intelPhaseChangeResidualDeepestDeepestDeeperPulseCoversDeepestDeeperMs(): boolean {
  return (
    INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS >=
    INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_MS
  );
}
