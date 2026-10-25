import { INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_MS } from "@/net/marchIntelPhaseChangeResidualDeepestDeepestDeepestDeeperPulse";

/** CLIENT-386：军情 phase 变更残余 **巩固再加深五层**扫读脉冲（与 CLIENT-370 五层脉冲 **并存**）。 */
export const INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS =
  "intel-phase-change-residual-deepest-deepest-deepest-deepest-deeper-pulse";
export const INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_MS = 2000;

let deepestDeepestDeepestDeepestDeeperPulseTimers = new WeakMap<
  HTMLElement,
  ReturnType<typeof setTimeout>
>();

export function clearIntelPhaseChangeResidualDeepestDeepestDeepestDeepestDeeperPulse(
  el: HTMLElement | null | undefined,
): void {
  if (!el) return;
  const prev = deepestDeepestDeepestDeepestDeeperPulseTimers.get(el);
  if (prev != null) {
    clearTimeout(prev);
    deepestDeepestDeepestDeepestDeeperPulseTimers.delete(el);
  }
  el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS);
}

export function scheduleIntelPhaseChangeResidualDeepestDeepestDeepestDeepestDeeperPulse(
  el: HTMLElement | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_MS,
): void {
  if (!el) return;
  const prev = deepestDeepestDeepestDeepestDeeperPulseTimers.get(el);
  if (prev != null) {
    windowObj.clearTimeout(prev);
    deepestDeepestDeepestDeepestDeeperPulseTimers.delete(el);
  }
  el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS);
  void el.offsetWidth;
  el.classList.add(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS);
  const timer = windowObj.setTimeout(() => {
    el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS);
    deepestDeepestDeepestDeepestDeeperPulseTimers.delete(el);
  }, durationMs);
  deepestDeepestDeepestDeepestDeeperPulseTimers.set(el, timer);
}

export function resetIntelPhaseChangeResidualDeepestDeepestDeepestDeepestDeeperPulseTimersForTests(): void {
  deepestDeepestDeepestDeepestDeeperPulseTimers = new WeakMap();
}

/** 巩固再加深五层脉冲时长须覆盖 CLIENT-370 五层脉冲，避免更深环先摘后五层脉冲仍亮造成误读。 */
export function intelPhaseChangeResidualDeepestDeepestDeepestDeepestDeeperPulseCoversDeepestDeepestDeepestDeeperMs(): boolean {
  return (
    INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_MS >=
    INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_MS
  );
}
