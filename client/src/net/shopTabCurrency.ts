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
