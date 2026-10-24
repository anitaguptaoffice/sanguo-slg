import { describe, expect, it } from "vitest";
import {
  bagItemCfgDisplayKind,
  formatBagItemCfgSummary,
  lookupBagItemLocalCfg,
} from "@/net/bagItemCfgSummary";

describe("formatBagItemCfgSummary (CLIENT-175)", () => {
  it("maps display kind for seed catalog ids", () => {
    expect(bagItemCfgDisplayKind(2017)).toBe("养成");
    expect(bagItemCfgDisplayKind(2001)).toBe("消耗");
    expect(bagItemCfgDisplayKind(9999)).toBe("其他");
  });

  it("renders brief + stack cap from local cfg and ListPlayerBag quantity", () => {
    expect(formatBagItemCfgSummary({ item_cfg_id: 2017, quantity: 3 })).toBe(
      "养成 · 将领经验 · 堆叠 3/999",
    );
    expect(formatBagItemCfgSummary({ item_cfg_id: 2001, quantity: 12 })).toBe(
      "消耗 · 立刻充实粮栈 · 堆叠 12/99",
    );
  });

  it("falls back to held quantity when cfg unknown", () => {
    expect(formatBagItemCfgSummary({ item_cfg_id: 8888, quantity: 4 })).toBe("其他 · 持 4");
  });

  it("lookupBagItemLocalCfg returns max_stack subset", () => {
    expect(lookupBagItemLocalCfg(2003)?.maxStack).toBe(999);
    expect(lookupBagItemLocalCfg(404)).toBeNull();
  });
});
