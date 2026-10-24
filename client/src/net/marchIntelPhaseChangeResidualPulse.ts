/** CLIENT-258：军情 phase 变更残余扫读脉冲（与 CLIENT-221 `intel-phase-change-flash` 并存）。 */
export const INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS = "intel-phase-change-residual-pulse";
export const INTEL_PHASE_CHANGE_RESIDUAL_PULSE_MS = 1500;

export function scheduleIntelPhaseChangeResidualPulse(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS);
  void el.offsetWidth;
  el.classList.add(INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS);
  window.setTimeout(
    () => el.classList.remove(INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS),
    INTEL_PHASE_CHANGE_RESIDUAL_PULSE_MS,
  );
}
