import { describe, expect, it } from "vitest";
import {
  buildWalletGapSegments,
  consumableUseWalletNeed,
  formatWalletGapLine,
  renderWalletGapMarkup,
} from "@/net/walletGap";

describe("walletGap", () => {
  const wallet = { food: 100, wood: 50, iron: 0, stone: 200 };

  it("formatWalletGapLine compares need vs wallet for shop prices", () => {
    expect(
      formatWalletGapLine({ food: 50, wood: 10 }, wallet),
    ).toBe("粮 需50/余100 · 木 需10/余50");
    expect(formatWalletGapLine({ food: 150 }, wallet)).toBe("粮 需150/余100");
    expect(formatWalletGapLine({ gold: 99 }, wallet)).toBeNull();
  });

  it("scales required amounts by multiplier", () => {
    expect(formatWalletGapLine({ food: 25 }, wallet, { multiplier: 2 })).toBe("粮 需50/余100");
  });

  it("marks insufficient segments", () => {
    const segments = buildWalletGapSegments({ food: 150, wood: 10 }, wallet);
    expect(segments.find((s) => s.key === "food")?.insufficient).toBe(true);
    expect(segments.find((s) => s.key === "wood")?.insufficient).toBe(false);
  });

  it("includeZeroNeed shows four-resource balance for consumables", () => {
    expect(consumableUseWalletNeed(2001, 3)).toEqual({});
    expect(
      formatWalletGapLine(consumableUseWalletNeed(2001, 1), wallet, { includeZeroNeed: true }),
    ).toBe("粮 需0/余100 · 木 需0/余50 · 铁 需0/余0 · 石 需0/余200");
  });

  it("renderWalletGapMarkup highlights insufficient labels", () => {
    const html = renderWalletGapMarkup({ food: 150, wood: 10 }, wallet);
    expect(html).toContain('class="resource-gap-warn">粮</span>');
    expect(html).toContain('class="resource-gap-label">木</span>');
  });
});
