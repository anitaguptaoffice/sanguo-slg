import { describe, expect, it } from "vitest";
import {
  formatShopOfferListLine,
  formatShopPurchaseFeedback,
  formatUseConsumableEffectSummary,
  gatewayErrorMessage,
} from "@/net/contentFeedback";

describe("contentFeedback", () => {
  it("formats gateway errors with stable code", () => {
    const err = new Error("余额不足");
    (err as Error & { code: number }).code = 64003;
    expect(gatewayErrorMessage(err)).toBe("[64003] 余额不足");
    expect(gatewayErrorMessage(new Error("timeout"))).toBe("timeout");
  });

  it("summarizes use consumable with server effect and wallet gain", () => {
    const text = formatUseConsumableEffectSummary(
      2001,
      { effect_summary: "获得粮食 1000", wallet_after: { food: 1100 } },
      { food: 100 },
      { food: 1100 },
    );
    expect(text).toContain("谷袋");
    expect(text).toContain("获得粮食 1000");
    expect(text).toContain("+粮");
  });

  it("derives speedup summary for 2003", () => {
    const text = formatUseConsumableEffectSummary(2003, { speedup_seconds: 300 });
    expect(text).toContain("急工符");
    expect(text).toContain("加速 5 分钟");
  });

  it("formats shop offer line with limit and sold out", () => {
    expect(
      formatShopOfferListLine(
        {
          offer_id: 1001,
          shelf_name: "每日",
          item_cfg_id: 2001,
          quantity_per_purchase: 1,
          purchase_limit: 3,
          purchased_count: 1,
        },
        "币10",
      ),
    ).toContain("限购 1/3");
    expect(
      formatShopOfferListLine({ offer_id: 2, item_cfg_id: 2001, sold_out: true }, "免费"),
    ).toContain("售罄");
  });

  it("formats purchase success with wallet mirror", () => {
    const line = formatShopPurchaseFeedback(1, { gold: 90, food: 500 }, {
      itemCfgId: 2001,
      grantedQty: 1,
    });
    expect(line).toContain("已购 +1");
    expect(line).toContain("谷袋");
    expect(line).toContain("钱包");
    expect(line).toContain("币 90");
  });
});
