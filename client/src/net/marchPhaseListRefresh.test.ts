import { describe, expect, it, vi, afterEach } from "vitest";
import type { MarchSummary } from "@/net/militaryFormat";
import {
  detectMarchPhaseChanges,
  MARCH_PHASE_CHANGED_PULSE_CLASS,
  MARCH_PHASE_CHANGED_PULSE_MS,
  scheduleMarchPhaseChangedPulse,
} from "@/net/marchPhaseListRefresh";

describe("detectMarchPhaseChanges", () => {
  it("returns march ids whose phase changed between snapshots", () => {
    const prev: MarchSummary[] = [
      { march_id: 1, phase: 2 },
      { march_id: 2, phase: 2 },
    ];
    const next: MarchSummary[] = [
      { march_id: 1, phase: 3 },
      { march_id: 2, phase: 2 },
    ];
    expect(detectMarchPhaseChanges(prev, next)).toEqual([1]);
  });

  it("ignores newly appeared marches", () => {
    const prev: MarchSummary[] = [{ march_id: 1, phase: 2 }];
    const next: MarchSummary[] = [
      { march_id: 1, phase: 2 },
      { march_id: 9, phase: 1 },
    ];
    expect(detectMarchPhaseChanges(prev, next)).toEqual([]);
  });
});

describe("scheduleMarchPhaseChangedPulse", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("toggles march-phase-changed class for 3s", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleMarchPhaseChangedPulse(row);
    expect(row.classList.contains(MARCH_PHASE_CHANGED_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(MARCH_PHASE_CHANGED_PULSE_MS);
    expect(row.classList.contains(MARCH_PHASE_CHANGED_PULSE_CLASS)).toBe(false);
  });
});
