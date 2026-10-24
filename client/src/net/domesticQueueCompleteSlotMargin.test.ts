import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DOMESTIC_QUEUE_COMPLETE_SLOT_MARGIN_CLASS,
  formatDomesticQueueCompleteSlotMarginLabel,
  resetDomesticQueueCompleteSlotMarginTimersForTests,
  scheduleDomesticQueueCompleteSlotMargin,
} from "@/net/domesticQueueCompleteSlotMargin";

describe("domesticQueueCompleteSlotMargin (CLIENT-212)", () => {
  afterEach(() => {
    resetDomesticQueueCompleteSlotMarginTimersForTests();
    vi.restoreAllMocks();
  });

  it("formatDomesticQueueCompleteSlotMarginLabel distinguishes idle vs upgrading", () => {
    const now = 1_000_000;
    expect(formatDomesticQueueCompleteSlotMarginLabel(undefined, now)).toBe("空闲槽");
    expect(
      formatDomesticQueueCompleteSlotMarginLabel(
        { slot_key: "farm", upgrade_finish_at_ms: now - 1 },
        now,
      ),
    ).toBe("空闲槽");
    expect(
      formatDomesticQueueCompleteSlotMarginLabel(
        { slot_key: "farm", upgrade_finish_at_ms: now + 60_000 },
        now,
      ),
    ).toBe("升级中槽");
  });

  it("scheduleDomesticQueueCompleteSlotMargin adds margin class with label", () => {
    const layer = document.createElement("div");
    const tag = document.createElement("div");
    tag.className = "main-city-slot-upgrade-tag";
    tag.dataset.slotKey = "farm";
    layer.appendChild(tag);

    const timeouts: Array<() => void> = [];
    const win = {
      setTimeout: (fn: () => void) => {
        timeouts.push(fn);
        return timeouts.length;
      },
    } as Pick<Window, "setTimeout">;

    expect(
      scheduleDomesticQueueCompleteSlotMargin(layer, "farm", "空闲槽", win),
    ).toBe(true);

    const margin = tag.querySelector(`.${DOMESTIC_QUEUE_COMPLETE_SLOT_MARGIN_CLASS}`);
    expect(margin?.textContent).toBe("空闲槽");
    expect(margin?.classList.contains(DOMESTIC_QUEUE_COMPLETE_SLOT_MARGIN_CLASS)).toBe(true);

    timeouts[0]?.();
    expect(tag.querySelector(`.${DOMESTIC_QUEUE_COMPLETE_SLOT_MARGIN_CLASS}`)).toBeNull();
  });
});
