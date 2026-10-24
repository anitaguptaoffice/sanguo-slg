import { afterEach, describe, expect, it, vi } from "vitest";
import {
  INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_PULSE_MS,
  scheduleIntelPhaseChangeResidualPulse,
} from "@/net/marchIntelPhaseChangeResidualPulse";

describe("scheduleIntelPhaseChangeResidualPulse (CLIENT-258)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("toggles intel-phase-change-residual-pulse class for 1.5s", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleIntelPhaseChangeResidualPulse(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(INTEL_PHASE_CHANGE_RESIDUAL_PULSE_MS);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS)).toBe(false);
  });
});
