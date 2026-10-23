import { describe, expect, it } from "vitest";
import {
  buildMarchArrivalReminders,
  detectNewMarchArrivalReminders,
  formatMarchArrivedStatusMessage,
  MARCH_PHASE_ARRIVED,
  MARCH_PHASE_MARCHING,
} from "@/net/marchArrival";
import { MARCH_PHASE_REMINDER_SESSION_KEY } from "@/net/marchPhaseReminderSession";

describe("buildMarchArrivalReminders", () => {
  it("includes coords and report_id from next snapshot", () => {
    const prev = [{ march_id: 2, phase: MARCH_PHASE_MARCHING, to_x: 8, to_y: 9 }];
    const next = [
      { march_id: 2, phase: MARCH_PHASE_ARRIVED, to_x: 8, to_y: 9, report_id: 44 },
    ];
    expect(buildMarchArrivalReminders(prev, next, new Set([2]))).toEqual([
      {
        kind: "phase",
        marchId: 2,
        toX: 8,
        toY: 9,
        reportId: 44,
      },
    ]);
  });
});

describe("detectNewMarchArrivalReminders", () => {
  it("dedupes via sessionStorage", () => {
    const storage = {
      data: new Map<string, string>(),
      getItem(key: string) {
        return this.data.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        this.data.set(key, value);
      },
    };
    const prev = [{ march_id: 1, phase: MARCH_PHASE_MARCHING }];
    const next = [{ march_id: 1, phase: MARCH_PHASE_ARRIVED, to_x: 1, to_y: 2 }];
    expect(detectNewMarchArrivalReminders(prev, next, new Set(), storage)).toHaveLength(1);
    expect(detectNewMarchArrivalReminders(prev, next, new Set(), storage)).toHaveLength(0);
    expect(storage.data.has(MARCH_PHASE_REMINDER_SESSION_KEY)).toBe(true);
  });
});

describe("formatMarchArrivedStatusMessage", () => {
  it("formats march id and grid", () => {
    expect(formatMarchArrivedStatusMessage(9, 60, 61)).toBe("行军 #9 已到达 (60,61)");
  });
});
