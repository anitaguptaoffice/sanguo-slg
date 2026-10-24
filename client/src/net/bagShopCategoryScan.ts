/** CLIENT-242：背包/商城分类 tab 切换时首条匹配行扫描高亮环。 */
export const BAG_SHOP_CATEGORY_SCAN_RING_CLASS = "bag-shop-category-scan-ring";
export const BAG_SHOP_CATEGORY_SCAN_RING_MS = 1500;

export type BagShopCategoryScanPanel = "bag" | "shop";

const BAG_SCAN_ROW_SELECTOR = ".bag-list li.bag-stack-row";
const SHOP_SCAN_ROW_SELECTOR = ".shop-list li";

let categoryScanRingTimer: ReturnType<typeof setTimeout> | null = null;

/** 分类过滤后列表首条可扫读行（不含 loading/error 占位行）。 */
export function findFirstBagShopCategoryScanRow(
  panelRoot: ParentNode | null | undefined,
  panel: BagShopCategoryScanPanel,
): HTMLElement | null {
  if (!panelRoot) return null;
  const selector = panel === "bag" ? BAG_SCAN_ROW_SELECTOR : SHOP_SCAN_ROW_SELECTOR;
  const row = panelRoot.querySelector<HTMLElement>(selector);
  return row ?? null;
}

/** 首条匹配行附加 `bag-shop-category-scan-ring` 1.5s（CLIENT-194/092 行内态不退化）。 */
export function highlightBagShopCategoryScanRow(
  panelRoot: ParentNode | null | undefined,
  panel: BagShopCategoryScanPanel,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): boolean {
  const row = findFirstBagShopCategoryScanRow(panelRoot, panel);
  if (!row) return false;
  row.classList.add(BAG_SHOP_CATEGORY_SCAN_RING_CLASS);
  if (categoryScanRingTimer) windowObj.clearTimeout(categoryScanRingTimer);
  categoryScanRingTimer = windowObj.setTimeout(() => {
    row.classList.remove(BAG_SHOP_CATEGORY_SCAN_RING_CLASS);
    categoryScanRingTimer = null;
  }, BAG_SHOP_CATEGORY_SCAN_RING_MS);
  return true;
}
