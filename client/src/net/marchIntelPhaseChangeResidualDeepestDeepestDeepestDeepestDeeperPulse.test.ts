import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_MS,
  resetIntelPhaseChangeResidualDeepestDeepestDeepestDeeperPulseTimersForTests,
} from "@/net/marchIntelPhaseChangeResidualDeepestDeepestDeepestDeeperPulse";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_MS,
  intelPhaseChangeResidualDeepestDeepestDeepestDeepestDeeperPulseCoversDeepestDeepestDeepestDeeperMs,
  resetIntelPhaseChangeResidualDeepestDeepestDeepestDeepestDeeperPulseTimersForTests,
  scheduleIntelPhaseChangeResidualDeepestDeepestDeepestDeepestDeeperPulse,
} from "@/net/marchIntelPhaseChangeResidualDeepestDeepestDeepestDeepestDeeperPulse";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS,
  pulseIntelPhaseChangeResidualOnPhaseChange,
  resetIntelPhaseChangeResidualDeepPulseTimersForTests,
} from "@/net/marchIntelPhaseChangeResidualDeepPulse";
import { resetIntelPhaseChangeResidualDeeperPulseTimersForTests } from "@/net/marchIntelPhaseChangeResidualDeeperPulse";
import { resetIntelPhaseChangeResidualDeepestPulseTimersForTests } from "@/net/marchIntelPhaseChangeResidualDeepestPulse";
import { INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS } from "@/net/marchIntelPhaseChangeResidualPulse";
import { resetIntelPhaseChangeResidualDeepestDeeperPulseTimersForTests } from "@/net/marchIntelPhaseChangeResidualDeepestDeeperPulse";
import { resetIntelPhaseChangeResidualDeepestDeepestDeeperPulseTimersForTests } from "@/net/marchIntelPhaseChangeResidualDeepestDeepestDeeperPulse";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS,
  resetIntelPhaseChangeResidualDeepestDeepestDeepestPulseTimersForTests,
} from "@/net/marchIntelPhaseChangeResidualDeepestDeepestDeepestPulse";

describe("scheduleIntelPhaseChangeResidualDeepestDeepestDeepestDeepestDeeperPulse (CLIENT-386)", () => {
  afterEach(() => {
    resetIntelPhaseChangeResidualDeepestDeepestDeepestDeepestDeeperPulseTimersForTests();
    resetIntelPhaseChangeResidualDeepestDeepestDeepestDeeperPulseTimersForTests();
    resetIntelPhaseChangeResidualDeepestDeepestDeepestPulseTimersForTests();
    resetIntelPhaseChangeResidualDeepestDeepestDeeperPulseTimersForTests();
    resetIntelPhaseChangeResidualDeepestDeeperPulseTimersForTests();
    resetIntelPhaseChangeResidualDeepestPulseTimersForTests();
    resetIntelPhaseChangeResidualDeeperPulseTimersForTests();
    resetIntelPhaseChangeResidualDeepPulseTimersForTests();
    vi.useRealTimers();
  });

  it("toggles intel-phase-change-residual-deepest-deepest-deepest-deepest-deeper-pulse class for 2s", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleIntelPhaseChangeResidualDeepestDeepestDeepestDeepestDeeperPulse(row);
    expect(
      row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS),
    ).toBe(true);
    vi.advanceTimersByTime(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_MS);
    expect(
      row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS),
    ).toBe(false);
  });

  it("re-schedule does not stack duplicate deepest-deepest-deepest-deepest-deeper pulse timers on same row", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleIntelPhaseChangeResidualDeepestDeepestDeepestDeepestDeeperPulse(row);
    vi.advanceTimersByTime(500);
    scheduleIntelPhaseChangeResidualDeepestDeepestDeepestDeepestDeeperPulse(row);
    expect(
      row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS),
    ).toBe(true);
    vi.advanceTimersByTime(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_MS);
    expect(
      row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS),
    ).toBe(false);
  });

  it("pulseIntelPhaseChangeResidualOnPhaseChange layers residual through deepest-deepest-deepest-deepest-deeper pulse", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    pulseIntelPhaseChangeResidualOnPhaseChange(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS)).toBe(true);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS)).toBe(true);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS)).toBe(
      true,
    );
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS)).toBe(
      true,
    );
    expect(
      row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS),
    ).toBe(true);
  });

  it("deepest-deepest-deepest-deepest-deeper pulse duration covers CLIENT-370 deepest-deepest-deepest-deeper pulse", () => {
    expect(
      intelPhaseChangeResidualDeepestDeepestDeepestDeepestDeeperPulseCoversDeepestDeepestDeepestDeeperMs(),
    ).toBe(true);
    expect(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_MS).toBe(
      INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_MS,
    );
  });
});
