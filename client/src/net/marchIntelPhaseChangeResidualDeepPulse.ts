import { scheduleIntelPhaseChangeResidualDeeperPulse } from "@/net/marchIntelPhaseChangeResidualDeeperPulse";
import { scheduleIntelPhaseChangeResidualDeepestPulse } from "@/net/marchIntelPhaseChangeResidualDeepestPulse";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_PULSE_MS,
  scheduleIntelPhaseChangeResidualPulse,
} from "@/net/marchIntelPhaseChangeResidualPulse";

/** CLIENT-274：军情 phase 变更残余 **巩固加深**扫读脉冲（与 CLIENT-258 残余脉冲 **并存**）。 */
export const INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS =
  "intel-phase-change-residual-deep-pulse";
export const INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_MS = 2000;

let deepPulseTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

export function clearIntelPhaseChangeResidualDeepPulse(el: HTMLElement | null | undefined): void {
  if (!el) return;
  const prev = deepPulseTimers.get(el);
  if (prev != null) {
    clearTimeout(prev);
    deepPulseTimers.delete(el);
  }
  el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS);
}

export function scheduleIntelPhaseChangeResidualDeepPulse(
  el: HTMLElement | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_MS,
): void {
  if (!el) return;
  const prev = deepPulseTimers.get(el);
  if (prev != null) {
    windowObj.clearTimeout(prev);
    deepPulseTimers.delete(el);
  }
  el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS);
  void el.offsetWidth;
  el.classList.add(INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS);
  const timer = windowObj.setTimeout(() => {
    el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS);
    deepPulseTimers.delete(el);
  }, durationMs);
  deepPulseTimers.set(el, timer);
}

/**
 * phase 变更扫读：CLIENT-258 残余 + CLIENT-274 深脉冲 + CLIENT-290 巩固再加深 + CLIENT-306 巩固再加深一层（CLIENT-221 flash / wave:39 主脉冲 **不重复堆叠**）。
 */
export function pulseIntelPhaseChangeResidualOnPhaseChange(el: HTMLElement | null | undefined): void {
  scheduleIntelPhaseChangeResidualPulse(el);
  scheduleIntelPhaseChangeResidualDeepPulse(el);
  scheduleIntelPhaseChangeResidualDeeperPulse(el);
  scheduleIntelPhaseChangeResidualDeepestPulse(el);
}

export function resetIntelPhaseChangeResidualDeepPulseTimersForTests(): void {
  deepPulseTimers = new WeakMap();
}

/** 深脉冲时长须覆盖 CLIENT-258 残余脉冲，避免深环先摘后残余仍亮造成误读。 */
export function intelPhaseChangeResidualDeepPulseCoversResidualMs(): boolean {
  return INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_MS >= INTEL_PHASE_CHANGE_RESIDUAL_PULSE_MS;
}
