import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_MS,
  resetIntelPhaseChangeResidualDeepestDeeperPulseTimersForTests,
} from "@/net/marchIntelPhaseChangeResidualDeepestDeeperPulse";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS,
  intelPhaseChangeResidualDeepestDeepestDeeperPulseCoversDeepestDeeperMs,
  resetIntelPhaseChangeResidualDeepestDeepestDeeperPulseTimersForTests,
  scheduleIntelPhaseChangeResidualDeepestDeepestDeeperPulse,
} from "@/net/marchIntelPhaseChangeResidualDeepestDeepestDeeperPulse";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS,
  pulseIntelPhaseChangeResidualOnPhaseChange,
  resetIntelPhaseChangeResidualDeepPulseTimersForTests,
} from "@/net/marchIntelPhaseChangeResidualDeepPulse";
import { INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS } from "@/net/marchIntelPhaseChangeResidualPulse";
import { resetIntelPhaseChangeResidualDeeperPulseTimersForTests } from "@/net/marchIntelPhaseChangeResidualDeeperPulse";
import { resetIntelPhaseChangeResidualDeepestPulseTimersForTests } from "@/net/marchIntelPhaseChangeResidualDeepestPulse";

describe("scheduleIntelPhaseChangeResidualDeepestDeepestDeeperPulse (CLIENT-338)", () => {
  afterEach(() => {
    resetIntelPhaseChangeResidualDeepestDeepestDeeperPulseTimersForTests();
    resetIntelPhaseChangeResidualDeepestDeeperPulseTimersForTests();
    resetIntelPhaseChangeResidualDeepestPulseTimersForTests();
    resetIntelPhaseChangeResidualDeeperPulseTimersForTests();
    resetIntelPhaseChangeResidualDeepPulseTimersForTests();
    vi.useRealTimers();
  });

  it("toggles intel-phase-change-residual-deepest-deepest-deeper-pulse class for 2s", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleIntelPhaseChangeResidualDeepestDeepestDeeperPulse(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS)).toBe(
      true,
    );
    vi.advanceTimersByTime(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS)).toBe(
      false,
    );
  });

  it("re-schedule does not stack duplicate deepest-deepest-deeper pulse timers on same row", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleIntelPhaseChangeResidualDeepestDeepestDeeperPulse(row);
    vi.advanceTimersByTime(500);
    scheduleIntelPhaseChangeResidualDeepestDeepestDeeperPulse(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS)).toBe(
      true,
    );
    vi.advanceTimersByTime(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS)).toBe(
      false,
    );
  });

  it("pulseIntelPhaseChangeResidualOnPhaseChange layers residual through deepest-deepest-deeper pulse", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    pulseIntelPhaseChangeResidualOnPhaseChange(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS)).toBe(true);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS)).toBe(true);
    expect(row.classList.contains("intel-phase-change-residual-deeper-pulse")).toBe(true);
    expect(row.classList.contains("intel-phase-change-residual-deepest-pulse")).toBe(true);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS)).toBe(true);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS)).toBe(
      true,
    );
  });

  it("deepest-deepest-deeper pulse duration covers CLIENT-322 deepest-deeper pulse", () => {
    expect(intelPhaseChangeResidualDeepestDeepestDeeperPulseCoversDeepestDeeperMs()).toBe(true);
    expect(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS).toBe(
      INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_MS,
    );
  });
});
