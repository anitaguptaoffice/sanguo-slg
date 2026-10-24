import { afterEach, describe, expect, it } from "vitest";
import {
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_CLASS,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_MS,
  resetDomesticQueueCompleteFocusResidualDeeperRingTimersForTests,
  scheduleDomesticQueueCompleteFocusResidualDeeperRing,
} from "@/net/domesticQueueCompleteFocusResidualDeeperRing";

afterEach(() => {
  resetDomesticQueueCompleteFocusResidualDeeperRingTimersForTests();
});

describe("domesticQueueCompleteFocusResidualDeeperRing (CLIENT-276)", () => {
  it("scheduleDomesticQueueCompleteFocusResidualDeeperRing applies class for 3s", () => {
    const layer = document.createElement("div");
    const tag = document.createElement("div");
    tag.className = "main-city-slot-upgrade-tag";
    tag.dataset.slotKey = "farm";
    layer.appendChild(tag);

    const timeouts: Array<() => void> = [];
    const win = {
      setTimeout: (fn: () => void, ms: number) => {
        expect(ms).toBe(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_MS);
        timeouts.push(fn);
        return 1 as ReturnType<typeof setTimeout>;
      },
    };

    expect(scheduleDomesticQueueCompleteFocusResidualDeeperRing(layer, "farm", win)).toBe(true);
    expect(tag.classList.contains(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_CLASS)).toBe(
      true,
    );
    timeouts[0]?.();
    expect(tag.classList.contains(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_CLASS)).toBe(
      false,
    );
  });

  it("exports residual deeper ring class constant", () => {
    expect(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_CLASS).toBe(
      "domestic-queue-complete-focus-residual-deeper-ring",
    );
  });
});
