import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_MS,
  intelPhaseChangeResidualDeepPulseCoversResidualMs,
  pulseIntelPhaseChangeResidualOnPhaseChange,
  resetIntelPhaseChangeResidualDeepPulseTimersForTests,
  scheduleIntelPhaseChangeResidualDeepPulse,
} from "@/net/marchIntelPhaseChangeResidualDeepPulse";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_CLASS,
  resetIntelPhaseChangeResidualDeeperPulseTimersForTests,
} from "@/net/marchIntelPhaseChangeResidualDeeperPulse";
import { INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS } from "@/net/marchIntelPhaseChangeResidualPulse";

describe("scheduleIntelPhaseChangeResidualDeepPulse (CLIENT-274)", () => {
  afterEach(() => {
    resetIntelPhaseChangeResidualDeepPulseTimersForTests();
    resetIntelPhaseChangeResidualDeeperPulseTimersForTests();
    vi.useRealTimers();
  });

  it("toggles intel-phase-change-residual-deep-pulse class for 2s", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleIntelPhaseChangeResidualDeepPulse(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_MS);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS)).toBe(false);
  });

  it("re-schedule does not stack duplicate deep pulse timers on same row", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleIntelPhaseChangeResidualDeepPulse(row);
    vi.advanceTimersByTime(500);
    scheduleIntelPhaseChangeResidualDeepPulse(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_MS);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS)).toBe(false);
  });

  it("pulseIntelPhaseChangeResidualOnPhaseChange layers CLIENT-258 residual + deep + CLIENT-290 deeper pulse", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    pulseIntelPhaseChangeResidualOnPhaseChange(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS)).toBe(true);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS)).toBe(true);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_CLASS)).toBe(true);
  });

  it("deep pulse duration covers CLIENT-258 residual pulse", () => {
    expect(intelPhaseChangeResidualDeepPulseCoversResidualMs()).toBe(true);
  });
});
