import { afterEach, describe, expect, it } from "vitest";
import {
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_CLASS,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_MS,
  resetDomesticQueueCompleteFocusResidualDeepestRingTimersForTests,
  scheduleDomesticQueueCompleteFocusResidualDeepestRing,
} from "@/net/domesticQueueCompleteFocusResidualDeepestRing";

afterEach(() => {
  resetDomesticQueueCompleteFocusResidualDeepestRingTimersForTests();
});

describe("domesticQueueCompleteFocusResidualDeepestRing (CLIENT-292)", () => {
  it("scheduleDomesticQueueCompleteFocusResidualDeepestRing applies class for 3s", () => {
    const layer = document.createElement("div");
    const tag = document.createElement("div");
    tag.className = "main-city-slot-upgrade-tag";
    tag.dataset.slotKey = "farm";
    layer.appendChild(tag);

    const timeouts: Array<() => void> = [];
    const win = {
      setTimeout: (fn: () => void, ms: number) => {
        expect(ms).toBe(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_MS);
        timeouts.push(fn);
        return 1 as ReturnType<typeof setTimeout>;
      },
    };

    expect(scheduleDomesticQueueCompleteFocusResidualDeepestRing(layer, "farm", win)).toBe(true);
    expect(tag.classList.contains(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_CLASS)).toBe(
      true,
    );
    timeouts[0]?.();
    expect(tag.classList.contains(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_CLASS)).toBe(
      false,
    );
  });

  it("exports residual deepest ring class constant", () => {
    expect(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_CLASS).toBe(
      "domestic-queue-complete-focus-residual-deepest-ring",
    );
  });
});
