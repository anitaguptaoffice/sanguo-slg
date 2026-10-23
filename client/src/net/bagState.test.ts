import { describe, expect, it } from "vitest";
import {
  applyUseResult,
  bagFromListPlayerBagResponse,
  bagStackQuantity,
  mergeRewardBundle,
  stacksFromList,
} from "@/net/bagState";

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

  it("normalizes gateway ListPlayerBag items", () => {
    expect(bagFromListPlayerBagResponse(undefined)).toEqual([]);
    expect(
      bagFromListPlayerBagResponse([
        { item_cfg_id: 2003, quantity: 2 },
        { item_cfg_id: 2001, quantity: 1 },
        { item_cfg_id: 0, quantity: 5 },
      ]),
    ).toEqual([
      { item_cfg_id: 2001, quantity: 1 },
      { item_cfg_id: 2003, quantity: 2 },
    ]);
    const merged = mergeRewardBundle(bagFromListPlayerBagResponse([{ item_cfg_id: 2001, quantity: 1 }]), {
      items: [{ item_cfg_id: 2001, quantity: 1 }],
    });
    expect(merged).toEqual([{ item_cfg_id: 2001, quantity: 2 }]);
  });

  it("reads stack quantity by cfg id", () => {
    expect(bagStackQuantity([], 2003)).toBe(0);
    expect(bagStackQuantity([{ item_cfg_id: 2003, quantity: 2 }], 2003)).toBe(2);
  });

  it("filters zero stacks", () => {
    expect(stacksFromList([{ item_cfg_id: 1, quantity: 0 }, { item_cfg_id: 2, quantity: 1 }])).toEqual([
      { item_cfg_id: 2, quantity: 1 },
    ]);
  });
});
