import { describe, expect, it } from "vitest";
import {
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS,
  resetDomesticQueueCompleteFocusResidualDeepestDeepestDeepestDeepestDeeperRingTimersForTests,
  scheduleDomesticQueueCompleteFocusResidualDeepestDeepestDeepestDeepestDeeperRing,
} from "@/net/domesticQueueCompleteFocusResidualDeepestDeepestDeepestDeepestDeeperRing";

describe("scheduleDomesticQueueCompleteFocusResidualDeepestDeepestDeepestDeepestDeeperRing (CLIENT-372 stub)", () => {
  it("applies deepest-deepest-deepest-deepest-deeper complete-focus ring for 3.5s", () => {
    resetDomesticQueueCompleteFocusResidualDeepestDeepestDeepestDeepestDeeperRingTimersForTests();
    const layer = document.createElement("div");
    const tag = document.createElement("span");
    tag.className = "main-city-slot-upgrade-tag";
    tag.dataset.slotKey = "farm";
    layer.appendChild(tag);
    const timeouts: Array<{ ms: number; fn: () => void }> = [];
    const win = {
      setTimeout: (fn: () => void, ms: number) => {
        timeouts.push({ ms, fn });
        return timeouts.length as ReturnType<typeof setTimeout>;
      },
    };
    expect(
      scheduleDomesticQueueCompleteFocusResidualDeepestDeepestDeepestDeepestDeeperRing(
        layer,
        "farm",
        win,
      ),
    ).toBe(true);
    expect(
      tag.classList.contains(
        DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
      ),
    ).toBe(true);
    expect(
      timeouts.some(
        (t) =>
          t.ms === DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS,
      ),
    ).toBe(true);
    for (const t of timeouts) {
      if (
        t.ms === DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS
      ) {
        t.fn();
      }
    }
    expect(
      tag.classList.contains(
        DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
      ),
    ).toBe(false);
  });
});
