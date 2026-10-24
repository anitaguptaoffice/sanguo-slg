import { describe, expect, it } from "vitest";
import { buildQueueMatrixIndexForSlot } from "@/net/buildQueueMatrix";
import {
  detectRecruitQueueJustCompleted,
  RECRUIT_QUEUE_MATRIX_SLOT_KEY,
} from "@/net/recruitQueueComplete";

describe("recruitQueueComplete", () => {
  const now = 1_000_000;

  it("detectRecruitQueueJustCompleted when finish_at_ms crosses now", () => {
    const prev = [{ queue_id: 2, unit_cfg_id: 1, count: 10, finish_at_ms: now + 500 }];
    const next = [{ queue_id: 2, unit_cfg_id: 1, count: 10, finish_at_ms: now - 1 }];
    expect(detectRecruitQueueJustCompleted(prev, next, now)).toEqual([2]);
  });

  it("detectRecruitQueueJustCompleted when batch drops from snapshot after finish", () => {
    const prev = [{ queue_id: 5, unit_cfg_id: 1, count: 8, finish_at_ms: now + 100 }];
    expect(detectRecruitQueueJustCompleted(prev, [], now)).toEqual([5]);
  });

  it("detectRecruitQueueJustCompleted ignores still-active batches", () => {
    const entry = { queue_id: 1, unit_cfg_id: 1, count: 5, finish_at_ms: now + 60_000 };
    expect(detectRecruitQueueJustCompleted([entry], [entry], now)).toEqual([]);
  });

  it("recruit queue mutual jump uses barracks matrix index", () => {
    expect(RECRUIT_QUEUE_MATRIX_SLOT_KEY).toBe("barracks");
    expect(buildQueueMatrixIndexForSlot(RECRUIT_QUEUE_MATRIX_SLOT_KEY)).toBe(5);
  });
});
