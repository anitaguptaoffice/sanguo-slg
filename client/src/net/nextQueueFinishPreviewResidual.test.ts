import { describe, expect, it } from "vitest";
import {
  DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_CLASS,
  DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_MS,
  formatNextQueueFinishPreviewResidualLine,
  pulseDomesticSlotCompleteMarginResidualRing,
  resetDomesticSlotCompleteMarginResidualRingTimersForTests,
} from "@/net/nextQueueFinishPreviewResidual";

describe("formatNextQueueFinishPreviewResidualLine (CLIENT-245)", () => {
  const now = 1_700_000_000_000;

  it("summarizes cfg + ETA for nearest build without duplicating main preview prefix", () => {
    const residual = formatNextQueueFinishPreviewResidualLine(
      [{ slot_key: "farm", building_cfg_id: 2, level: 1, upgrade_finish_at_ms: now + 90_000 }],
      [],
      { farm: "农田" },
      [],
      now,
    );
    expect(residual?.line).toContain("残余扫读");
    expect(residual?.line).toContain("cfg#2");
    expect(residual?.line).toContain("农田");
    expect(residual?.line).toContain("ETA 剩余");
    expect(residual?.line).not.toContain("下一完成");
    expect(residual?.slotKey).toBe("farm");
  });

  it("uses barracks slot for recruit queue", () => {
    const residual = formatNextQueueFinishPreviewResidualLine(
      [],
      [{ queue_id: 3, unit_cfg_id: 1, count: 8, finish_at_ms: now + 60_000 }],
      {},
      [],
      now,
    );
    expect(residual?.line).toContain("募兵");
    expect(residual?.slotKey).toBe("barracks");
  });

  it("returns null when no active queue", () => {
    expect(formatNextQueueFinishPreviewResidualLine([], [], {}, [], now)).toBeNull();
  });
});

describe("pulseDomesticSlotCompleteMarginResidualRing (CLIENT-245)", () => {
  it("applies margin residual ring class for 1.5s", () => {
    resetDomesticSlotCompleteMarginResidualRingTimersForTests();
    const layer = document.createElement("div");
    const tag = document.createElement("span");
    tag.className = "main-city-slot-upgrade-tag";
    tag.dataset.slotKey = "farm";
    layer.appendChild(tag);
    const win = {
      setTimeout: (fn: () => void, ms: number) => {
        expect(ms).toBe(DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_MS);
        fn();
        return 1 as ReturnType<typeof setTimeout>;
      },
    };
    expect(pulseDomesticSlotCompleteMarginResidualRing(layer, "farm", win)).toBe(true);
    expect(tag.classList.contains(DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_CLASS)).toBe(false);
  });
});
