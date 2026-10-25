import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_MS,
  resetIntelPhaseChangeResidualDeeperPulseTimersForTests,
} from "@/net/marchIntelPhaseChangeResidualDeeperPulse";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_MS,
  intelPhaseChangeResidualDeepestPulseCoversDeeperMs,
  resetIntelPhaseChangeResidualDeepestPulseTimersForTests,
  scheduleIntelPhaseChangeResidualDeepestPulse,
} from "@/net/marchIntelPhaseChangeResidualDeepestPulse";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS,
  pulseIntelPhaseChangeResidualOnPhaseChange,
  resetIntelPhaseChangeResidualDeepPulseTimersForTests,
} from "@/net/marchIntelPhaseChangeResidualDeepPulse";
import { INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS } from "@/net/marchIntelPhaseChangeResidualPulse";

describe("scheduleIntelPhaseChangeResidualDeepestPulse (CLIENT-306)", () => {
  afterEach(() => {
    resetIntelPhaseChangeResidualDeepestPulseTimersForTests();
    resetIntelPhaseChangeResidualDeeperPulseTimersForTests();
    resetIntelPhaseChangeResidualDeepPulseTimersForTests();
    vi.useRealTimers();
  });

  it("toggles intel-phase-change-residual-deepest-pulse class for 2s", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleIntelPhaseChangeResidualDeepestPulse(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_MS);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_CLASS)).toBe(false);
  });

  it("re-schedule does not stack duplicate deepest pulse timers on same row", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleIntelPhaseChangeResidualDeepestPulse(row);
    vi.advanceTimersByTime(500);
    scheduleIntelPhaseChangeResidualDeepestPulse(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_MS);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_CLASS)).toBe(false);
  });

  it("pulseIntelPhaseChangeResidualOnPhaseChange layers residual + deep + deeper + deepest pulse", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    pulseIntelPhaseChangeResidualOnPhaseChange(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS)).toBe(true);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS)).toBe(true);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_CLASS)).toBe(true);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_CLASS)).toBe(true);
  });

  it("deepest pulse duration covers CLIENT-290 deeper pulse", () => {
    expect(intelPhaseChangeResidualDeepestPulseCoversDeeperMs()).toBe(true);
    expect(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_MS).toBe(INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_MS);
  });
});
