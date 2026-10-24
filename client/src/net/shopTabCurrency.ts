import type { ResourceWallet } from "@/net/bootstrapSession";
import type { ShopOfferRow } from "@/net/contentFeedback";
import { formatResourceAmount, WALLET_RESOURCE_KEYS } from "@/net/hudFormat";
import {
  filterShopOffersByCategory,
  type ShopOfferClientCategory,
} from "@/net/shopOfferCategory";

export type ShopPriceCurrency = keyof ResourceWallet;

/**
 * DATA-002 / cfg_shop_offer 只读：无 price_resources 时按 item_cfg_id 回退主结算币种（silver→gold）。
 * 不在客户端扩 SKU 表，仅覆盖 M4 冒烟常见 offer。
 */
const SHOP_SKU_PRICE_CURRENCY_FALLBACK: ReadonlyMap<number, ShopPriceCurrency> = new Map([
  [2001, "gold"],
  [2002, "gold"],
  [2003, "gold"],
]);

/** 从 offer `price_resources`（+ SKU 回退）推导结算币种，顺序与 WALLET_RESOURCE_KEYS 一致。 */
export function resolveShopOfferPriceCurrencies(offer: ShopOfferRow): ShopPriceCurrency[] {
  const price = offer.price_resources ?? {};
  const keys: ShopPriceCurrency[] = [];
  for (const { key } of WALLET_RESOURCE_KEYS) {
    if ((price[key] ?? 0) > 0) keys.push(key);
  }
  if (!keys.length) {
    const fallback = SHOP_SKU_PRICE_CURRENCY_FALLBACK.get(offer.item_cfg_id ?? 0);
    if (fallback) keys.push(fallback);
  }
  return keys;
}

/** 当前分类 tab 下货架涉及的结算币种（去重，稳定顺序）。 */
export function resolveShopTabCurrency(
  offers: ShopOfferRow[],
  category: ShopOfferClientCategory,
): ShopPriceCurrency[] {
  const visible = filterShopOffersByCategory(offers, category);
  const set = new Set<ShopPriceCurrency>();
  for (const o of visible) {
    for (const key of resolveShopOfferPriceCurrencies(o)) set.add(key);
  }
  return WALLET_RESOURCE_KEYS.map(({ key }) => key).filter((key) => set.has(key));
}

/** 分类 tab 旁只读余额扫读（wallet 快照）。 */
export function formatShopTabWalletBalanceLine(
  wallet: ResourceWallet | undefined,
  currencies: ShopPriceCurrency[],
): string | null {
  if (!currencies.length) return null;
  const parts = currencies.map((key) => {
    const label = WALLET_RESOURCE_KEYS.find((e) => e.key === key)?.label ?? String(key);
    return `${label} ${formatResourceAmount(wallet?.[key])}`;
  });
  return `本类余额：${parts.join(" · ")}`;
}

/**
 * 行内现价/余额并排扫读（CLIENT-154 不足「缺少」行内态之外补充）。
 * 例：`币 现价10/余额50`。
 */
export function formatShopPriceVsWallet(
  wallet: ResourceWallet | undefined,
  price: ResourceWallet | undefined,
  purchaseCount = 1,
): string | null {
  const count = Math.max(1, Math.floor(purchaseCount));
  const parts: string[] = [];
  for (const { key, label } of WALLET_RESOURCE_KEYS) {
    const unit = price?.[key] ?? 0;
    if (unit <= 0) continue;
    const need = unit * count;
    const have = wallet?.[key] ?? 0;
    parts.push(`${label} 现价${formatResourceAmount(need)}/余额${formatResourceAmount(have)}`);
  }
  if (!parts.length) return null;
  return parts.join(" · ");
}

/**
 * 行内标价/余额/缺口只读对比（CLIENT-194；与 CLIENT-167 `formatShopPriceVsWallet` 并存）。
 * 例：`币 标价10/余额5/缺5`；足额时省略缺口段。
 */
export function formatShopPriceWalletGapLine(
  wallet: ResourceWallet | undefined,
  price: ResourceWallet | undefined,
  purchaseCount = 1,
): string | null {
  const count = Math.max(1, Math.floor(purchaseCount));
  const parts: string[] = [];
  for (const { key, label } of WALLET_RESOURCE_KEYS) {
    const unit = price?.[key] ?? 0;
    if (unit <= 0) continue;
    const need = unit * count;
    const have = wallet?.[key] ?? 0;
    const gap = Math.max(0, need - have);
    const segment = gap > 0
      ? `${label} 标价${formatResourceAmount(need)}/余额${formatResourceAmount(have)}/缺${formatResourceAmount(gap)}`
      : `${label} 标价${formatResourceAmount(need)}/余额${formatResourceAmount(have)}`;
    parts.push(segment);
  }
  if (!parts.length) return null;
  return parts.join(" · ");
}

/** 商城列表行缺口对比 DOM 类名（CLIENT-194）。 */
export const SHOP_PRICE_WALLET_GAP_LINE_CLASS = "shop-price-wallet-gap";

/** 商城分类顶栏标价 vs 钱包只读对比行（CLIENT-215；与 CLIENT-167 余额扫读并存）。 */
export const SHOP_WALLET_COMPARE_LINE_ROLE = "shop-wallet-compare-line";
export const SHOP_WALLET_COMPARE_LINE_CLASS = "shop-wallet-compare-line";
export const SHOP_WALLET_COMPARE_DEFICIT_CLASS = "shop-wallet-compare-deficit";

export type ShopWalletCompareLine = {
  text: string;
  hasDeficit: boolean;
};

function shopLineMark(sufficient: boolean): string {
  return sufficient ? "✓" : "不足";
}

/** 当前分类 tab 下各结算币种最低单价（只读；不扩 SKU）。 */
export function resolveShopTabMinUnitPrices(
  offers: ShopOfferRow[],
  category: ShopOfferClientCategory,
): Partial<ResourceWallet> {
  const visible = filterShopOffersByCategory(offers, category);
  const mins: Partial<Record<ShopPriceCurrency, number>> = {};
  for (const o of visible) {
    const price = o.price_resources ?? {};
    for (const key of resolveShopOfferPriceCurrencies(o)) {
      const unit = price[key] ?? 0;
      if (unit <= 0) continue;
      const prev = mins[key];
      mins[key] = prev == null ? unit : Math.min(prev, unit);
    }
  }
  return mins;
}

/**
 * 商城分类顶栏：本 tab 标价币种（最低单价）vs HUD 钱包余额只读并排对比。
 * 与 `formatShopTabWalletBalanceLine` / 行内 `formatShopPriceWalletGapLine` **不退化**。
 */
export function formatShopWalletCompareLine(
  wallet: ResourceWallet | undefined,
  offers: ShopOfferRow[],
  category: ShopOfferClientCategory,
): ShopWalletCompareLine | null {
  const currencies = resolveShopTabCurrency(offers, category);
  if (!currencies.length) return null;
  const mins = resolveShopTabMinUnitPrices(offers, category);
  const parts: string[] = [];
  let hasDeficit = false;
  for (const key of currencies) {
    const label = WALLET_RESOURCE_KEYS.find((e) => e.key === key)?.label ?? String(key);
    const need = mins[key] ?? 0;
    const have = wallet?.[key] ?? 0;
    const sufficient = have >= need;
    if (!sufficient) hasDeficit = true;
    parts.push(
      `${label} 标价${formatResourceAmount(need)} | 余额${formatResourceAmount(have)}${shopLineMark(sufficient)}`,
    );
  }
  if (!parts.length) return null;
  return { text: parts.join(" · "), hasDeficit };
}

export function syncShopWalletCompareLine(
  shopRoot: ParentNode | null | undefined,
  compare: ShopWalletCompareLine | null,
): void {
  const el = shopRoot?.querySelector<HTMLElement>(
    `[data-role="${SHOP_WALLET_COMPARE_LINE_ROLE}"]`,
  );
  if (!el) return;
  if (!compare?.text) {
    el.textContent = "";
    el.hidden = true;
    el.classList.remove(SHOP_WALLET_COMPARE_DEFICIT_CLASS);
    return;
  }
  el.textContent = compare.text;
  el.hidden = false;
  el.classList.toggle(SHOP_WALLET_COMPARE_DEFICIT_CLASS, compare.hasDeficit);
}
