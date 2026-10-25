import { INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_MS } from "@/net/marchIntelPhaseChangeResidualDeeperPulse";
/** CLIENT-306：军情 phase 变更残余 **巩固再加深一层**扫读脉冲（与 CLIENT-290 更深脉冲 **并存**）。 */
export const INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_CLASS =
  "intel-phase-change-residual-deepest-pulse";
export const INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_MS = 2000;

let deepestPulseTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

export function clearIntelPhaseChangeResidualDeepestPulse(el: HTMLElement | null | undefined): void {
  if (!el) return;
  const prev = deepestPulseTimers.get(el);
  if (prev != null) {
    clearTimeout(prev);
    deepestPulseTimers.delete(el);
  }
  el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_CLASS);
}

export function scheduleIntelPhaseChangeResidualDeepestPulse(
  el: HTMLElement | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_MS,
): void {
  if (!el) return;
  const prev = deepestPulseTimers.get(el);
  if (prev != null) {
    windowObj.clearTimeout(prev);
    deepestPulseTimers.delete(el);
  }
  el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_CLASS);
  void el.offsetWidth;
  el.classList.add(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_CLASS);
  const timer = windowObj.setTimeout(() => {
    el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_CLASS);
    deepestPulseTimers.delete(el);
  }, durationMs);
  deepestPulseTimers.set(el, timer);
}

export function resetIntelPhaseChangeResidualDeepestPulseTimersForTests(): void {
  deepestPulseTimers = new WeakMap();
}

/** 巩固再加深一层脉冲时长须覆盖 CLIENT-290 更深脉冲，避免最深环先摘后更深脉冲仍亮造成误读。 */
export function intelPhaseChangeResidualDeepestPulseCoversDeeperMs(): boolean {
  return INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_MS >= INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_MS;
}
