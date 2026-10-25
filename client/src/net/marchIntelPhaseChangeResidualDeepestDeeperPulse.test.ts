import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_MS,
  resetIntelPhaseChangeResidualDeepestPulseTimersForTests,
} from "@/net/marchIntelPhaseChangeResidualDeepestPulse";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_MS,
  intelPhaseChangeResidualDeepestDeeperPulseCoversDeepestMs,
  resetIntelPhaseChangeResidualDeepestDeeperPulseTimersForTests,
  scheduleIntelPhaseChangeResidualDeepestDeeperPulse,
} from "@/net/marchIntelPhaseChangeResidualDeepestDeeperPulse";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS,
  pulseIntelPhaseChangeResidualOnPhaseChange,
  resetIntelPhaseChangeResidualDeepPulseTimersForTests,
} from "@/net/marchIntelPhaseChangeResidualDeepPulse";
import { INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS } from "@/net/marchIntelPhaseChangeResidualPulse";
import { resetIntelPhaseChangeResidualDeeperPulseTimersForTests } from "@/net/marchIntelPhaseChangeResidualDeeperPulse";

describe("scheduleIntelPhaseChangeResidualDeepestDeeperPulse (CLIENT-322)", () => {
  afterEach(() => {
    resetIntelPhaseChangeResidualDeepestDeeperPulseTimersForTests();
    resetIntelPhaseChangeResidualDeepestPulseTimersForTests();
    resetIntelPhaseChangeResidualDeeperPulseTimersForTests();
    resetIntelPhaseChangeResidualDeepPulseTimersForTests();
    vi.useRealTimers();
  });

  it("toggles intel-phase-change-residual-deepest-deeper-pulse class for 2s", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleIntelPhaseChangeResidualDeepestDeeperPulse(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_MS);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS)).toBe(false);
  });

  it("re-schedule does not stack duplicate deepest-deeper pulse timers on same row", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleIntelPhaseChangeResidualDeepestDeeperPulse(row);
    vi.advanceTimersByTime(500);
    scheduleIntelPhaseChangeResidualDeepestDeeperPulse(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_MS);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS)).toBe(false);
  });

  it("pulseIntelPhaseChangeResidualOnPhaseChange layers residual through deepest-deeper pulse", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    pulseIntelPhaseChangeResidualOnPhaseChange(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS)).toBe(true);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS)).toBe(true);
    expect(row.classList.contains("intel-phase-change-residual-deeper-pulse")).toBe(true);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_CLASS)).toBe(true);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS)).toBe(true);
  });

  it("deepest-deeper pulse duration covers CLIENT-306 deepest pulse", () => {
    expect(intelPhaseChangeResidualDeepestDeeperPulseCoversDeepestMs()).toBe(true);
    expect(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_MS).toBe(
      INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_MS,
    );
  });
});
