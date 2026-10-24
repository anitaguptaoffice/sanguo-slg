import { describe, expect, it } from "vitest";
import {
  formatShopPriceVsWallet,
  formatShopTabWalletBalanceLine,
  resolveShopOfferPriceCurrencies,
  resolveShopTabCurrency,
} from "@/net/shopTabCurrency";
import type { ShopOfferRow } from "@/net/contentFeedback";

describe("resolveShopOfferPriceCurrencies", () => {
  it("reads positive price_resources keys in wallet order", () => {
    expect(
      resolveShopOfferPriceCurrencies({
        offer_id: 1007,
        price_resources: { wood: 200, gold: 50 },
      }),
    ).toEqual(["wood", "gold"]);
  });

  it("falls back to SKU gold when price missing", () => {
    expect(resolveShopOfferPriceCurrencies({ item_cfg_id: 2001 })).toEqual(["gold"]);
  });
});

describe("resolveShopTabCurrency", () => {
  const offers: ShopOfferRow[] = [
    { offer_id: 1, item_cfg_id: 2001, price_resources: { gold: 10 } },
    { offer_id: 2, item_cfg_id: 2003, price_resources: { gold: 30 } },
    { offer_id: 3, item_cfg_id: 2020, price_resources: { food: 400 } },
  ];

  it("union currencies for all tab", () => {
    expect(resolveShopTabCurrency(offers, "all")).toEqual(["food", "gold"]);
  });

  it("resource tab is gold-only for daily bundles", () => {
    expect(resolveShopTabCurrency(offers, "resource")).toEqual(["gold"]);
  });

  it("other tab picks non-resource/speedup offers", () => {
    expect(resolveShopTabCurrency(offers, "other")).toEqual(["food"]);
  });
});

describe("formatShopTabWalletBalanceLine", () => {
  it("formats balances for tab currencies", () => {
    expect(formatShopTabWalletBalanceLine({ gold: 50, food: 1200 }, ["gold", "food"])).toBe(
      "本类余额：币 50 · 粮 1,200",
    );
  });

  it("returns null when no currencies", () => {
    expect(formatShopTabWalletBalanceLine({ gold: 1 }, [])).toBeNull();
  });
});

describe("formatShopPriceVsWallet", () => {
  it("shows price and wallet side by side", () => {
    expect(formatShopPriceVsWallet({ gold: 5 }, { gold: 10 }, 1)).toBe("币 现价10/余额5");
    expect(formatShopPriceVsWallet({ food: 100, wood: 50 }, { food: 50, wood: 20 }, 2)).toBe(
      "粮 现价100/余额100 · 木 现价40/余额50",
    );
  });

  it("returns null when price empty", () => {
    expect(formatShopPriceVsWallet({ gold: 1 }, {})).toBeNull();
  });
});
