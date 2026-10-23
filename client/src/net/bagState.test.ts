import { describe, expect, it } from "vitest";
import { applyUseResult, mergeRewardBundle } from "@/net/bagState";

describe("bagState", () => {
  it("merges reward items into bag", () => {
    const bag = mergeRewardBundle([], {
      items: [{ item_cfg_id: 2001, quantity: 1 }],
    });
    expect(bag).toEqual([{ item_cfg_id: 2001, quantity: 1 }]);
    const again = mergeRewardBundle(bag, {
      items: [{ item_cfg_id: 2001, quantity: 2 }],
    });
    expect(again[0].quantity).toBe(3);
  });

  it("applies use remaining", () => {
    const bag = [{ item_cfg_id: 2001, quantity: 3 }];
    expect(applyUseResult(bag, 2001, 0)).toEqual([]);
    expect(applyUseResult(bag, 2001, 1)[0].quantity).toBe(1);
  });
});
