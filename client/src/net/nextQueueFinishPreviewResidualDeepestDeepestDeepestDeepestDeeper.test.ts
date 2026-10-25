import { describe, expect, it } from "vitest";
import {
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS,
  formatNextQueueFinishPreviewResidualDeepestDeepestDeepestDeepestDeeperLine,
  pulseDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeepestDeepestDeeperRing,
  resetDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeepestDeepestDeeperRingTimersForTests,
} from "@/net/nextQueueFinishPreviewResidualDeepestDeepestDeepestDeepestDeeper";
import {
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
} from "@/net/nextQueueFinishPreviewResidualDeepestDeepestDeepestDeeper";
import {
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS,
} from "@/net/nextQueueFinishPreviewResidualDeepestDeepestDeepest";
import {
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
} from "@/net/nextQueueFinishPreviewResidualDeepestDeepestDeeper";
import {
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_RING_CLASS,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_CLASS,
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

describe("formatNextQueueFinishPreviewResidualDeepestDeepestDeepestDeepestDeeperLine (CLIENT-373)", () => {
  const now = 1_700_000_000_000;

  it("consolidates dual-queue counts, slot label, and ETA with deepest-deepest-deepest-deepest-deeper-layer prefix", () => {
    const deepestDeepestDeepestDeepestDeeper =
      formatNextQueueFinishPreviewResidualDeepestDeepestDeepestDeepestDeeperLine(
        [{ slot_key: "farm", building_cfg_id: 2, level: 1, upgrade_finish_at_ms: now + 90_000 }],
        [{ queue_id: 2, unit_cfg_id: 1, count: 4, finish_at_ms: now + 180_000 }],
        { farm: "农田" },
        [],
        now,
      );
    expect(deepestDeepestDeepestDeepestDeeper?.line).toContain("巩固再加深五层");
    expect(deepestDeepestDeepestDeepestDeeper?.line).not.toMatch(/^巩固再加深四层/);
    expect(deepestDeepestDeepestDeepestDeeper?.line).toContain("内政×1");
    expect(deepestDeepestDeepestDeepestDeeper?.line).toContain("募兵×1");
    expect(deepestDeepestDeepestDeepestDeeper?.line).toContain("槽位(农田)");
    expect(deepestDeepestDeepestDeepestDeeper?.line).toContain("下一完成(内政)");
    expect(deepestDeepestDeepestDeepestDeeper?.line).toContain("ETA");
    expect(deepestDeepestDeepestDeepestDeeper?.line).toContain("最深六层链");
    expect(deepestDeepestDeepestDeepestDeeper?.slotKey).toBe("farm");
  });

  it("uses barracks slot for nearest recruit queue", () => {
    const deepestDeepestDeepestDeepestDeeper =
      formatNextQueueFinishPreviewResidualDeepestDeepestDeepestDeepestDeeperLine(
        [],
        [{ queue_id: 3, unit_cfg_id: 1, count: 8, finish_at_ms: now + 60_000 }],
        { barracks: "兵营" },
        [],
        now,
      );
    expect(deepestDeepestDeepestDeepestDeeper?.line).toContain("募兵×1");
    expect(deepestDeepestDeepestDeepestDeeper?.line).toContain("下一完成(募兵)");
    expect(deepestDeepestDeepestDeepestDeeper?.slotKey).toBe("barracks");
  });

  it("returns null when no active queue", () => {
    expect(
      formatNextQueueFinishPreviewResidualDeepestDeepestDeepestDeepestDeeperLine(
        [],
        [],
        {},
        [],
        now,
      ),
    ).toBeNull();
  });
});

describe("pulseDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeepestDeepestDeeperRing (CLIENT-373)", () => {
  it("applies deepest-deepest-deepest-deepest-deeper cross-link ring for 3s and stacks deeper rings", () => {
    resetDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeepestDeepestDeeperRingTimersForTests();
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
    expect(
      pulseDomesticSlotPreviewCrossLinkResidualDeepestDeepestDeepestDeepestDeeperRing(layer, "farm", win),
    ).toBe(true);
    expect(
      tag.classList.contains(
        DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
      ),
    ).toBe(true);
    expect(
      tag.classList.contains(DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS),
    ).toBe(true);
    expect(
      tag.classList.contains(DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS),
    ).toBe(true);
    expect(
      tag.classList.contains(DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS),
    ).toBe(true);
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
    expect(
      tag.classList.contains(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS),
    ).toBe(true);
    expect(
      tag.classList.contains(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS),
    ).toBe(true);
    expect(
      tag.classList.contains(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS),
    ).toBe(true);
    expect(
      tag.classList.contains(
        DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
      ),
    ).toBe(true);
    expect(tag.classList.contains(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_CLASS)).toBe(true);

    expect(
      timeouts.some(
        (t) =>
          t.ms === DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS,
      ),
    ).toBe(true);
    for (const t of timeouts) {
      if (
        t.ms === DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS
      ) {
        t.fn();
      }
    }
    expect(
      tag.classList.contains(
        DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
      ),
    ).toBe(false);
  });
});
