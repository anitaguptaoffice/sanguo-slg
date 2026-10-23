import { describe, expect, it } from "vitest";
import {
  summarizeBatchUseConsumableResults,
  validateBatchUseConsumableSlots,
} from "@/net/bagBatchUse";

describe("validateBatchUseConsumableSlots", () => {
  const bag = [{ item_cfg_id: 2001, quantity: 3 }];

  it("accepts when slots fit bag quantity", () => {
    expect(
      validateBatchUseConsumableSlots({ itemCfgId: 2001, slotCount: 2, bag }),
    ).toEqual({ ok: true });
  });

  it("rejects recruit scroll batch", () => {
    const r = validateBatchUseConsumableSlots({
      itemCfgId: 2004,
      slotCount: 1,
      bag: [{ item_cfg_id: 2004, quantity: 1 }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("不支持批量使用");
  });

  it("rejects when slot count exceeds quantity", () => {
    const r = validateBatchUseConsumableSlots({ itemCfgId: 2001, slotCount: 5, bag });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("超过持有数量");
  });
});

describe("summarizeBatchUseConsumableResults", () => {
  it("aggregates all success", () => {
    const s = summarizeBatchUseConsumableResults([{ ok: true }, { ok: true }]);
    expect(s.successCount).toBe(2);
    expect(s.failureCount).toBe(0);
    expect(s.summaryText).toContain("成功 2 次");
    expect(s.lastError).toBeNull();
  });

  it("aggregates mixed results with last CLIENT-067 style error", () => {
    const s = summarizeBatchUseConsumableResults([
      { ok: true },
      { ok: false, message: "资源不足 [40001]" },
      { ok: false, message: "请求无效 [10001]" },
    ]);
    expect(s.successCount).toBe(1);
    expect(s.failureCount).toBe(2);
    expect(s.summaryText).toContain("失败 2 次");
    expect(s.summaryText).toContain("请求无效 [10001]");
    expect(s.lastError).toBe("请求无效 [10001]");
  });
});
