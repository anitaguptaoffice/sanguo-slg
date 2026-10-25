import { INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_MS } from "@/net/marchIntelPhaseChangeResidualDeepestPulse";

/** CLIENT-322：军情 phase 变更残余 **巩固再加深二层**扫读脉冲（与 CLIENT-306 最深脉冲 **并存**）。 */
export const INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS =
  "intel-phase-change-residual-deepest-deeper-pulse";
export const INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_MS = 2000;

let deepestDeeperPulseTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

export function clearIntelPhaseChangeResidualDeepestDeeperPulse(
  el: HTMLElement | null | undefined,
): void {
  if (!el) return;
  const prev = deepestDeeperPulseTimers.get(el);
  if (prev != null) {
    clearTimeout(prev);
    deepestDeeperPulseTimers.delete(el);
  }
  el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS);
}

export function scheduleIntelPhaseChangeResidualDeepestDeeperPulse(
  el: HTMLElement | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_MS,
): void {
  if (!el) return;
  const prev = deepestDeeperPulseTimers.get(el);
  if (prev != null) {
    windowObj.clearTimeout(prev);
    deepestDeeperPulseTimers.delete(el);
  }
  el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS);
  void el.offsetWidth;
  el.classList.add(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS);
  const timer = windowObj.setTimeout(() => {
    el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS);
    deepestDeeperPulseTimers.delete(el);
  }, durationMs);
  deepestDeeperPulseTimers.set(el, timer);
}

export function resetIntelPhaseChangeResidualDeepestDeeperPulseTimersForTests(): void {
  deepestDeeperPulseTimers = new WeakMap();
}

/** 巩固再加深二层脉冲时长须覆盖 CLIENT-306 最深脉冲，避免更深环先摘后最深脉冲仍亮造成误读。 */
export function intelPhaseChangeResidualDeepestDeeperPulseCoversDeepestMs(): boolean {
  return (
    INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_MS >= INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_MS
  );
}
