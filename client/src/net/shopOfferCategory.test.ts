import { describe, expect, it } from "vitest";
import {
  categorizeShopOffer,
  countShopOffersByCategory,
  filterShopOffersByCategory,
} from "@/net/shopOfferCategory";

describe("shopOfferCategory", () => {
  const offers = [
    { offer_id: 1, item_cfg_id: 2001, shelf_name: "每日特惠" },
    { offer_id: 2, item_cfg_id: 2003, shelf_name: "加速补给" },
    { offer_id: 3, item_cfg_id: 2004, shelf_name: "将领" },
  ];

  it("categorizes by item_cfg_id and shelf_name", () => {
    expect(categorizeShopOffer(offers[0])).toBe("resource");
    expect(categorizeShopOffer(offers[1])).toBe("speedup");
    expect(categorizeShopOffer(offers[2])).toBe("other");
  });

  it("filters list for active tab", () => {
    expect(filterShopOffersByCategory(offers, "resource").map((o) => o.offer_id)).toEqual([1]);
    expect(filterShopOffersByCategory(offers, "all")).toHaveLength(3);
  });

  it("counts per category for tab badges", () => {
    expect(countShopOffersByCategory(offers)).toEqual({
      all: 3,
      resource: 1,
      speedup: 1,
      other: 1,
    });
  });
});
