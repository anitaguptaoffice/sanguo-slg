import { describe, expect, it, vi, afterEach } from "vitest";
import type { MarchSummary } from "@/net/militaryFormat";
import {
  detectMarchPhaseChange,
  INTEL_PHASE_CHANGE_FLASH_CLASS,
  INTEL_PHASE_CHANGE_FLASH_MS,
  scheduleIntelPhaseChangeFlash,
} from "@/net/marchIntelPhaseChangeFlash";

describe("detectMarchPhaseChange (CLIENT-221)", () => {
  it("returns march ids whose phase changed between ListMarches snapshots", () => {
    const prev: MarchSummary[] = [
      { march_id: 1, phase: 2 },
      { march_id: 2, phase: 2 },
    ];
    const next: MarchSummary[] = [
      { march_id: 1, phase: 3 },
      { march_id: 2, phase: 2 },
    ];
    expect(detectMarchPhaseChange(prev, next)).toEqual([1]);
  });

  it("ignores newly appeared marches", () => {
    const prev: MarchSummary[] = [{ march_id: 1, phase: 2 }];
    const next: MarchSummary[] = [
      { march_id: 1, phase: 2 },
      { march_id: 9, phase: 1 },
    ];
    expect(detectMarchPhaseChange(prev, next)).toEqual([]);
  });
});

describe("scheduleIntelPhaseChangeFlash", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("toggles intel-phase-change-flash class for 2s", () => {
    vi.useFakeTimers();
    const row = document.createElement("li");
    scheduleIntelPhaseChangeFlash(row);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_FLASH_CLASS)).toBe(true);
    vi.advanceTimersByTime(INTEL_PHASE_CHANGE_FLASH_MS);
    expect(row.classList.contains(INTEL_PHASE_CHANGE_FLASH_CLASS)).toBe(false);
  });
});
