import { INTEL_PHASE_CHANGE_RESIDUAL_PULSE_MS } from "@/net/marchIntelPhaseChangeResidualPulse";

/** 与 CLIENT-274 `INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_MS` 对齐（避免与 deep 模块循环依赖）。 */
const INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_MS = 2000;
/** CLIENT-290：军情 phase 变更残余 **巩固再加深**扫读脉冲（与 CLIENT-274 深脉冲 **并存**）。 */
export const INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_CLASS =
  "intel-phase-change-residual-deeper-pulse";
export const INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_MS = 2000;

let deeperPulseTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

export function clearIntelPhaseChangeResidualDeeperPulse(el: HTMLElement | null | undefined): void {
  if (!el) return;
  const prev = deeperPulseTimers.get(el);
  if (prev != null) {
    clearTimeout(prev);
    deeperPulseTimers.delete(el);
  }
  el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_CLASS);
}

export function scheduleIntelPhaseChangeResidualDeeperPulse(
  el: HTMLElement | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_MS,
): void {
  if (!el) return;
  const prev = deeperPulseTimers.get(el);
  if (prev != null) {
    windowObj.clearTimeout(prev);
    deeperPulseTimers.delete(el);
  }
  el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_CLASS);
  void el.offsetWidth;
  el.classList.add(INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_CLASS);
  const timer = windowObj.setTimeout(() => {
    el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_CLASS);
    deeperPulseTimers.delete(el);
  }, durationMs);
  deeperPulseTimers.set(el, timer);
}

export function resetIntelPhaseChangeResidualDeeperPulseTimersForTests(): void {
  deeperPulseTimers = new WeakMap();
}

/** 巩固再加深脉冲时长须覆盖 CLIENT-274 深脉冲，避免更深环先摘后深脉冲仍亮造成误读。 */
export function intelPhaseChangeResidualDeeperPulseCoversDeepMs(): boolean {
  return INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_MS >= INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_MS;
}

/** CLIENT-258 残余脉冲仍须短于巩固再加深总扫读窗口。 */
export function intelPhaseChangeResidualDeeperPulseCoversResidualMs(): boolean {
  return INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_MS >= INTEL_PHASE_CHANGE_RESIDUAL_PULSE_MS;
}
