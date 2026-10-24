import { describe, expect, it } from "vitest";
import {
  BAG_CATEGORY_TAB_SESSION_KEY,
  categorizeBagStackRow,
  filterBagRowsByCategory,
  formatBagStackQty,
  parseBagCategoryTabSessionValue,
  readBagCategoryTabSession,
  writeBagCategoryTabSession,
} from "@/net/bagCategory";

describe("bagCategory (CLIENT-153)", () => {
  it("formatBagStackQty renders stack multiplier", () => {
    expect(formatBagStackQty(12)).toBe("×12");
    expect(formatBagStackQty(0)).toBe("×0");
    expect(formatBagStackQty(undefined)).toBe("×0");
  });

  it("categorizeBagStackRow maps seed catalog ids", () => {
    expect(categorizeBagStackRow({ item_cfg_id: 2001, quantity: 1 })).toBe("consumable");
    expect(categorizeBagStackRow({ item_cfg_id: 2003, quantity: 1 })).toBe("consumable");
    expect(categorizeBagStackRow({ item_cfg_id: 2017, quantity: 1 })).toBe("cultivation");
    expect(categorizeBagStackRow({ item_cfg_id: 2004, quantity: 1 })).toBe("cultivation");
  });

  it("filterBagRowsByCategory filters client snapshot only", () => {
    const rows = [
      { item_cfg_id: 2001, quantity: 2 },
      { item_cfg_id: 2017, quantity: 1 },
      { item_cfg_id: 2003, quantity: 5 },
    ];
    expect(filterBagRowsByCategory(rows, "all")).toHaveLength(3);
    expect(filterBagRowsByCategory(rows, "consumable").map((r) => r.item_cfg_id)).toEqual([
      2001,
      2003,
    ]);
    expect(filterBagRowsByCategory(rows, "cultivation").map((r) => r.item_cfg_id)).toEqual([2017]);
  });

  it("persists tab in sessionStorage key bag-category-tab-v1", () => {
    const storage = new Map<string, string>();
    const mock = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storage.set(k, v);
      },
    };
    expect(parseBagCategoryTabSessionValue("cultivation")).toBe("cultivation");
    expect(parseBagCategoryTabSessionValue("invalid")).toBeNull();
    writeBagCategoryTabSession("consumable", mock);
    expect(storage.get(BAG_CATEGORY_TAB_SESSION_KEY)).toBe("consumable");
    expect(readBagCategoryTabSession(mock)).toBe("consumable");
  });
});
