import { describe, expect, it } from "vitest";
import {
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_MS,
  formatNextQueueFinishPreviewResidualDeepLine,
  pulseDomesticSlotPreviewCrossLinkResidualDeepRing,
  resetDomesticSlotPreviewCrossLinkResidualDeepRingTimersForTests,
} from "@/net/nextQueueFinishPreviewResidualDeep";
import {
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_CLASS,
  resetDomesticQueueCompleteFocusResidualRingTimersForTests,
} from "@/net/domesticQueueCompleteFocusResidualRing";

describe("formatNextQueueFinishPreviewResidualDeepLine (CLIENT-261)", () => {
  const now = 1_700_000_000_000;

  it("consolidates dual-queue counts and nearest ETA without main-preview prefix", () => {
    const deep = formatNextQueueFinishPreviewResidualDeepLine(
      [{ slot_key: "farm", building_cfg_id: 2, level: 1, upgrade_finish_at_ms: now + 90_000 }],
      [{ queue_id: 2, unit_cfg_id: 1, count: 4, finish_at_ms: now + 180_000 }],
      { farm: "农田" },
      [],
      now,
    );
    expect(deep?.line).toContain("巩固扫读");
    expect(deep?.line).toContain("内政×1");
    expect(deep?.line).toContain("募兵×1");
    expect(deep?.line).toContain("下一完成(内政)");
    expect(deep?.line).toContain("ETA");
    expect(deep?.line).not.toContain("下一完成 [");
    expect(deep?.line).not.toContain("残余扫读");
    expect(deep?.line).not.toContain("cfg#");
    expect(deep?.slotKey).toBe("farm");
  });

  it("uses barracks slot for nearest recruit queue", () => {
    const deep = formatNextQueueFinishPreviewResidualDeepLine(
      [],
      [{ queue_id: 3, unit_cfg_id: 1, count: 8, finish_at_ms: now + 60_000 }],
      {},
      [],
      now,
    );
    expect(deep?.line).toContain("募兵×1");
    expect(deep?.line).toContain("下一完成(募兵)");
    expect(deep?.slotKey).toBe("barracks");
  });

  it("returns null when no active queue", () => {
    expect(formatNextQueueFinishPreviewResidualDeepLine([], [], {}, [], now)).toBeNull();
  });
});

describe("pulseDomesticSlotPreviewCrossLinkResidualDeepRing (CLIENT-261)", () => {
  it("applies preview cross-link deep ring for 2s and stacks focus rings", () => {
    resetDomesticSlotPreviewCrossLinkResidualDeepRingTimersForTests();
    resetDomesticQueueCompleteFocusResidualRingTimersForTests();
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
    expect(pulseDomesticSlotPreviewCrossLinkResidualDeepRing(layer, "farm", win)).toBe(true);
    expect(tag.classList.contains(DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS)).toBe(
      true,
    );
    expect(tag.classList.contains(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS)).toBe(
      true,
    );
    expect(tag.classList.contains(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_CLASS)).toBe(true);

    expect(
      timeouts.some((t) => t.ms === DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_MS),
    ).toBe(true);
    for (const t of timeouts) {
      if (t.ms === DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_MS) t.fn();
    }
    expect(tag.classList.contains(DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS)).toBe(
      false,
    );
  });
});
