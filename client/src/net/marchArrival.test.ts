import { describe, expect, it } from "vitest";
import {
  detectMarchCompletions,
  marchPhaseTransitionSignalsCompletion,
  MARCH_PHASE_ARRIVED,
  MARCH_PHASE_MARCHING,
  MARCH_PHASE_RETURNING,
} from "@/net/marchArrival";

describe("marchPhaseTransitionSignalsCompletion", () => {
  it("detects marching to arrived or returning", () => {
    expect(marchPhaseTransitionSignalsCompletion(MARCH_PHASE_MARCHING, MARCH_PHASE_ARRIVED)).toBe(
      true,
    );
    expect(
      marchPhaseTransitionSignalsCompletion(MARCH_PHASE_MARCHING, MARCH_PHASE_RETURNING),
    ).toBe(true);
    expect(marchPhaseTransitionSignalsCompletion(MARCH_PHASE_MARCHING, MARCH_PHASE_MARCHING)).toBe(
      false,
    );
    expect(marchPhaseTransitionSignalsCompletion(1, MARCH_PHASE_ARRIVED)).toBe(false);
  });
});

describe("detectMarchCompletions", () => {
  it("emits phase completion when marching becomes arrived", () => {
    const prev = [{ march_id: 3, phase: MARCH_PHASE_MARCHING }];
    const next = [{ march_id: 3, phase: MARCH_PHASE_ARRIVED }];
    const events = detectMarchCompletions(prev, next, new Set([3]));
    expect(events).toEqual([{ kind: "phase", marchId: 3 }]);
  });

  it("emits vanished when pending march disappears", () => {
    const prev = [{ march_id: 9, phase: MARCH_PHASE_MARCHING }];
    const next: typeof prev = [];
    const events = detectMarchCompletions(prev, next, new Set([9]));
    expect(events).toEqual([{ kind: "vanished", marchId: 9 }]);
  });

  it("ignores vanished rows not started by player", () => {
    const prev = [{ march_id: 9, phase: MARCH_PHASE_MARCHING }];
    const events = detectMarchCompletions(prev, [], new Set());
    expect(events).toEqual([]);
  });
});
