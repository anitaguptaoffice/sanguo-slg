import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS,
  resetIntelPhaseChangeResidualDeepestDeepestDeeperPulseTimersForTests,
} from "@/net/marchIntelPhaseChangeResidualDeepestDeepestDeeperPulse";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS,
  resetIntelPhaseChangeResidualDeepestDeeperPulseTimersForTests,
} from "@/net/marchIntelPhaseChangeResidualDeepestDeeperPulse";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS,
  pulseIntelPhaseChangeResidualOnPhaseChange,
  resetIntelPhaseChangeResidualDeepPulseTimersForTests,
} from "@/net/marchIntelPhaseChangeResidualDeepPulse";
import { resetIntelPhaseChangeResidualDeeperPulseTimersForTests } from "@/net/marchIntelPhaseChangeResidualDeeperPulse";
import { resetIntelPhaseChangeResidualDeepestPulseTimersForTests } from "@/net/marchIntelPhaseChangeResidualDeepestPulse";
import { INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS } from "@/net/marchIntelPhaseChangeResidualPulse";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_MS,
  intelPhaseChangeResidualDeepestDeepestDeepestPulseCoversDeepestDeepestDeeperMs,
  resetIntelPhaseChangeResidualDeepestDeepestDeepestPulseTimersForTests,
  scheduleIntelPhaseChangeResidualDeepestDeepestDeepestPulse,
} from "@/net/marchIntelPhaseChangeResidualDeepestDeepestDeepestPulse";

describe("scheduleIntelPhaseChangeResidualDeepestDeepestDeepestPulse (CLIENT-354)", () => {
  afterEach(() => {
    resetIntelPhaseChangeResidualDeepestDeepestDeepestPulseTimersForTests();
    resetIntelPhaseChangeResidualDeepestDeepestDeeperPulseTimersForTests();
    resetIntelPhaseChangeResidualDeepestDeeperPulseTimersForTests();
    resetIntelPhaseChangeResidualDeepestPulseTimersForTests();
    resetIntelPhaseChangeResidualDeeperPulseTimersForTests();
    resetIntelPhaseChangeResidualDeepPulseTimersForTests();
    vi.useRealTimers();
  });

  it("toggles intel-phase-change-residual-deepest-deepest-deepest-pulse class for 2s", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleIntelPhaseChangeResidualDeepestDeepestDeepestPulse(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS)).toBe(
      true,
    );
    vi.advanceTimersByTime(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_MS);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS)).toBe(
      false,
    );
  });

  it("re-schedule does not stack duplicate deepest-deepest-deepest pulse timers on same row", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleIntelPhaseChangeResidualDeepestDeepestDeepestPulse(row);
    vi.advanceTimersByTime(500);
    scheduleIntelPhaseChangeResidualDeepestDeepestDeepestPulse(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS)).toBe(
      true,
    );
    vi.advanceTimersByTime(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_MS);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS)).toBe(
      false,
    );
  });

  it("pulseIntelPhaseChangeResidualOnPhaseChange layers residual through deepest-deepest-deepest pulse", () => {
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
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS)).toBe(
      true,
    );
    expect(
      row.classList.contains("intel-phase-change-residual-deepest-deepest-deepest-deeper-pulse"),
    ).toBe(true);
  });

  it("deepest-deepest-deepest pulse duration covers CLIENT-338 deepest-deepest-deeper pulse", () => {
    expect(intelPhaseChangeResidualDeepestDeepestDeepestPulseCoversDeepestDeepestDeeperMs()).toBe(true);
    expect(INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_MS).toBe(
      INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS,
    );
  });
});
