import { describe, expect, it } from "vitest";
import { formatBagRowInlineState } from "@/net/bagRowInlineState";

describe("formatBagRowInlineState (CLIENT-194)", () => {
  it("combines stack qty and cfg summary for inline state", () => {
    expect(formatBagRowInlineState({ item_cfg_id: 2017, quantity: 3 })).toBe(
      "×3 · 养成 · 将领经验 · 堆叠 3/999",
    );
    expect(formatBagRowInlineState({ item_cfg_id: 2001, quantity: 12 })).toContain("×12");
    expect(formatBagRowInlineState({ item_cfg_id: 2001, quantity: 12 })).toContain("消耗");
  });
});
