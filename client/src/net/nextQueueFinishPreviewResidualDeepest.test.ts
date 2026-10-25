import { describe, expect, it } from "vitest";
import {
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_RING_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_RING_MS,
  formatNextQueueFinishPreviewResidualDeepestLine,
  pulseDomesticSlotPreviewCrossLinkResidualDeepestRing,
  resetDomesticSlotPreviewCrossLinkResidualDeepestRingTimersForTests,
} from "@/net/nextQueueFinishPreviewResidualDeepest";
import {
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPER_RING_CLASS,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_CLASS,
} from "@/net/nextQueueFinishPreviewResidualDeeper";
import {
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS,
} from "@/net/nextQueueFinishPreviewResidualDeep";
import {
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_CLASS,
  resetDomesticQueueCompleteFocusResidualRingTimersForTests,
} from "@/net/domesticQueueCompleteFocusResidualRing";

describe("formatNextQueueFinishPreviewResidualDeepestLine (CLIENT-293)", () => {
  const now = 1_700_000_000_000;

  it("consolidates dual-queue counts, slot label, and ETA with deepest-layer prefix", () => {
    const deepest = formatNextQueueFinishPreviewResidualDeepestLine(
      [{ slot_key: "farm", building_cfg_id: 2, level: 1, upgrade_finish_at_ms: now + 90_000 }],
      [{ queue_id: 2, unit_cfg_id: 1, count: 4, finish_at_ms: now + 180_000 }],
      { farm: "农田" },
      [],
      now,
    );
    expect(deepest?.line).toContain("巩固再加深一层");
    expect(deepest?.line).not.toMatch(/^巩固再加深 /);
    expect(deepest?.line).toContain("内政×1");
    expect(deepest?.line).toContain("募兵×1");
    expect(deepest?.line).toContain("槽位(农田)");
    expect(deepest?.line).toContain("下一完成(内政)");
    expect(deepest?.line).toContain("ETA");
    expect(deepest?.line).toContain("最深链");
    expect(deepest?.slotKey).toBe("farm");
  });

  it("uses barracks slot for nearest recruit queue", () => {
    const deepest = formatNextQueueFinishPreviewResidualDeepestLine(
      [],
      [{ queue_id: 3, unit_cfg_id: 1, count: 8, finish_at_ms: now + 60_000 }],
      { barracks: "兵营" },
      [],
      now,
    );
    expect(deepest?.line).toContain("募兵×1");
    expect(deepest?.line).toContain("下一完成(募兵)");
    expect(deepest?.slotKey).toBe("barracks");
  });

  it("returns null when no active queue", () => {
    expect(formatNextQueueFinishPreviewResidualDeepestLine([], [], {}, [], now)).toBeNull();
  });
});

describe("pulseDomesticSlotPreviewCrossLinkResidualDeepestRing (CLIENT-293)", () => {
  it("applies deepest cross-link ring for 2.5s and stacks deeper + focus rings", () => {
    resetDomesticSlotPreviewCrossLinkResidualDeepestRingTimersForTests();
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
    expect(pulseDomesticSlotPreviewCrossLinkResidualDeepestRing(layer, "farm", win)).toBe(true);
    expect(tag.classList.contains(DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_RING_CLASS)).toBe(
      true,
    );
    expect(tag.classList.contains(DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPER_RING_CLASS)).toBe(
      true,
    );
    expect(tag.classList.contains(DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS)).toBe(
      true,
    );
    expect(tag.classList.contains(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS)).toBe(
      true,
    );
    expect(tag.classList.contains(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_CLASS)).toBe(
      true,
    );
    expect(tag.classList.contains(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_CLASS)).toBe(
      true,
    );
    expect(tag.classList.contains(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_CLASS)).toBe(true);

    expect(
      timeouts.some((t) => t.ms === DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_RING_MS),
    ).toBe(true);
    for (const t of timeouts) {
      if (t.ms === DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_RING_MS) t.fn();
    }
    expect(tag.classList.contains(DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_RING_CLASS)).toBe(
      false,
    );
  });
});
