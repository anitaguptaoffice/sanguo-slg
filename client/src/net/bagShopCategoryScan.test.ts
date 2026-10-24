import { describe, expect, it, vi } from "vitest";
import {
  BAG_SHOP_CATEGORY_SCAN_RING_CLASS,
  BAG_SHOP_CATEGORY_SCAN_RING_MS,
  findFirstBagShopCategoryScanRow,
  highlightBagShopCategoryScanRow,
} from "@/net/bagShopCategoryScan";

describe("bagShopCategoryScan (CLIENT-242)", () => {
  it("findFirstBagShopCategoryScanRow skips panel state rows", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <ul class="bag-list" data-role="bag-list">
        <li class="panel-state-row">加载中</li>
        <li class="bag-stack-row" data-item-cfg-id="2001">a</li>
        <li class="bag-stack-row" data-item-cfg-id="2002">b</li>
      </ul>
    `;
    const row = findFirstBagShopCategoryScanRow(root, "bag");
    expect(row?.getAttribute("data-item-cfg-id")).toBe("2001");
  });

  it("highlightBagShopCategoryScanRow applies ring for 1.5s", () => {
    const root = document.createElement("div");
    root.innerHTML = `<ul class="shop-list"><li>offer</li></ul>`;
    const timers = {
      setTimeout: vi.fn((fn: () => void, ms: number) => {
        expect(ms).toBe(BAG_SHOP_CATEGORY_SCAN_RING_MS);
        fn();
        return 1 as unknown as ReturnType<typeof setTimeout>;
      }),
      clearTimeout: vi.fn(),
    };
    const ok = highlightBagShopCategoryScanRow(root, "shop", timers);
    const li = root.querySelector("li");
    expect(ok).toBe(true);
    expect(li?.classList.contains(BAG_SHOP_CATEGORY_SCAN_RING_CLASS)).toBe(false);
  });
});
