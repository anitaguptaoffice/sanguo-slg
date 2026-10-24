import { describe, expect, it } from "vitest";
import {
  formatShopOfferAffordInline,
  formatShopOfferPriceSummaryLine,
  shopOfferAffordInlineForRow,
} from "@/net/shopOfferAfford";

describe("formatShopOfferAffordInline", () => {
  it("returns null when wallet covers price", () => {
    expect(
      formatShopOfferAffordInline({ food: 100, gold: 20 }, { food: 50, gold: 10 }, 1),
    ).toBeNull();
  });

  it("lists shortfall per resource with CLIENT-067 prefix", () => {
    expect(
      formatShopOfferAffordInline({ food: 10, wood: 5, gold: 3 }, { food: 50, wood: 20, gold: 10 }, 1),
    ).toBe("缺少：粮 40 · 木 15 · 币 7");
  });

  it("scales shortfall by purchase count", () => {
    expect(formatShopOfferAffordInline({ gold: 5 }, { gold: 10 }, 2)).toBe("缺少：币 15");
  });

  it("formatShopOfferPriceSummaryLine mirrors scaled wallet price", () => {
    expect(formatShopOfferPriceSummaryLine({ food: 100, gold: 5 }, 2)).toBe("粮200 币10");
  });

  it("shopOfferAffordInlineForRow skips sold out", () => {
    expect(
      shopOfferAffordInlineForRow(
        { gold: 0 },
        { offer_id: 1, sold_out: true, price_resources: { gold: 10 } },
      ),
    ).toBeNull();
  });
});
