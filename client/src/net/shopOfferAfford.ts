import type { ResourceWallet } from "@/net/bootstrapSession";
import { formatWalletPrice } from "@/net/contentFormat";
import type { ShopOfferRow } from "@/net/contentFeedback";
import { formatResourceAmount, WALLET_RESOURCE_KEYS } from "@/net/hudFormat";
import { applyWalletGapBar } from "@/net/walletGap";

/**
 * CLIENT-067/092 口径：钱包不足时为「缺少：粮 N …」（差额）；足够时为 null。
 * 不含售罄/限购（由列表行与 validatePurchaseShopOffer 处理）。
 */
export function formatShopOfferAffordInline(
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
    if (have < need) {
      parts.push(`${label} ${formatResourceAmount(need - have)}`);
    }
  }
  if (!parts.length) return null;
  return `缺少：${parts.join(" · ")}`;
}

/** 足够时购买区只读价格摘要（与列表行 `formatWalletPrice` 一致）。 */
export function formatShopOfferPriceSummaryLine(
  price: ResourceWallet | undefined,
  purchaseCount = 1,
): string | null {
  if (!price) return null;
  const count = Math.max(1, Math.floor(purchaseCount));
  const scaled: ResourceWallet = {};
  for (const { key } of WALLET_RESOURCE_KEYS) {
    const unit = price[key] ?? 0;
    if (unit > 0) scaled[key] = unit * count;
  }
  const text = formatWalletPrice(scaled);
  return text || null;
}

export function shopOfferAffordInlineForRow(
  wallet: ResourceWallet | undefined,
  offer: ShopOfferRow,
  purchaseCount = 1,
): string | null {
  if (offer.sold_out) return null;
  return formatShopOfferAffordInline(wallet, offer.price_resources, purchaseCount);
}

/** 商城购买区 `data-role="shop-wallet-gap"`：不足行内「缺少」；足够时 CLIENT-092 需/余对比条。 */
export function applyShopPurchaseAffordDisplay(
  panelRoot: ParentNode | null | undefined,
  price: ResourceWallet | undefined,
  wallet: ResourceWallet | undefined,
  purchaseCount = 1,
): void {
  const el = panelRoot?.querySelector('[data-role="shop-wallet-gap"]');
  if (!el || !(el instanceof HTMLElement)) return;
  const afford = formatShopOfferAffordInline(wallet, price, purchaseCount);
  if (afford) {
    el.textContent = afford;
    el.classList.add("shop-afford-inline");
    el.classList.remove("hidden");
    return;
  }
  el.classList.remove("shop-afford-inline");
  applyWalletGapBar(panelRoot, "shop-wallet-gap", price, wallet, {
    multiplier: purchaseCount,
  });
}
