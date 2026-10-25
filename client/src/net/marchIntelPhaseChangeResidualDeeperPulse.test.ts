import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_MS,
  intelPhaseChangeResidualDeeperPulseCoversDeepMs,
  intelPhaseChangeResidualDeeperPulseCoversResidualMs,
  resetIntelPhaseChangeResidualDeeperPulseTimersForTests,
  scheduleIntelPhaseChangeResidualDeeperPulse,
} from "@/net/marchIntelPhaseChangeResidualDeeperPulse";
import { resetIntelPhaseChangeResidualDeepestDeeperPulseTimersForTests } from "@/net/marchIntelPhaseChangeResidualDeepestDeeperPulse";
import { resetIntelPhaseChangeResidualDeepestPulseTimersForTests } from "@/net/marchIntelPhaseChangeResidualDeepestPulse";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS,
  pulseIntelPhaseChangeResidualOnPhaseChange,
  resetIntelPhaseChangeResidualDeepPulseTimersForTests,
} from "@/net/marchIntelPhaseChangeResidualDeepPulse";
import { INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS } from "@/net/marchIntelPhaseChangeResidualPulse";

describe("scheduleIntelPhaseChangeResidualDeeperPulse (CLIENT-290)", () => {
  afterEach(() => {
    resetIntelPhaseChangeResidualDeepestDeeperPulseTimersForTests();
    resetIntelPhaseChangeResidualDeepestPulseTimersForTests();
    resetIntelPhaseChangeResidualDeeperPulseTimersForTests();
    resetIntelPhaseChangeResidualDeepPulseTimersForTests();
    vi.useRealTimers();
  });

  it("toggles intel-phase-change-residual-deeper-pulse class for 2s", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleIntelPhaseChangeResidualDeeperPulse(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_MS);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_CLASS)).toBe(false);
  });

  it("re-schedule does not stack duplicate deeper pulse timers on same row", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleIntelPhaseChangeResidualDeeperPulse(row);
    vi.advanceTimersByTime(500);
    scheduleIntelPhaseChangeResidualDeeperPulse(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_MS);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_CLASS)).toBe(false);
  });

  it("pulseIntelPhaseChangeResidualOnPhaseChange layers residual + deep + deeper pulse", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    pulseIntelPhaseChangeResidualOnPhaseChange(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS)).toBe(true);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS)).toBe(true);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_CLASS)).toBe(true);
    expect(row.classList.contains("intel-phase-change-residual-deepest-pulse")).toBe(true);
    expect(row.classList.contains("intel-phase-change-residual-deepest-deeper-pulse")).toBe(true);
  });

  it("deeper pulse duration covers CLIENT-274 deep and CLIENT-258 residual pulses", () => {
    expect(intelPhaseChangeResidualDeeperPulseCoversDeepMs()).toBe(true);
    expect(intelPhaseChangeResidualDeeperPulseCoversResidualMs()).toBe(true);
  });
});
