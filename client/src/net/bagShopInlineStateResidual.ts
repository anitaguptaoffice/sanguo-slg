import type { ResourceWallet } from "@/net/bootstrapSession";
import type { BagStack } from "@/net/bagState";
import { lookupBagItemLocalCfg } from "@/net/bagItemCfgSummary";
import { BAG_ROW_INLINE_STATE_CLASS } from "@/net/bagRowInlineState";
import { SHOP_OFFER_AFFORD_INLINE_CLASS } from "@/engine/mainCityWave30NarrowManifest";
import type { ShopOfferRow } from "@/net/contentFeedback";
import { shopOfferAffordInlineForRow } from "@/net/shopOfferAfford";
import { SHOP_PRICE_WALLET_GAP_LINE_CLASS } from "@/net/shopTabCurrency";

/** CLIENT-256：货币不足或堆叠上限时行内态残余环（CLIENT-194/092 行内文案不退化）。 */
export const BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS = "bag-shop-inline-state-residual-ring";
export const BAG_SHOP_INLINE_STATE_RESIDUAL_RING_MS = 1500;

export type BagShopInlineStateResidualPanel = "bag" | "shop";

let inlineStateResidualRingTimer: ReturnType<typeof setTimeout> | null = null;

/** 背包堆叠已达本地 cfg 上限（只读扫读，不发 RPC）。 */
export function isBagStackAtCap(row: BagStack): boolean {
  const itemCfgId = row.item_cfg_id ?? 0;
  const meta = lookupBagItemLocalCfg(itemCfgId);
  if (!meta || meta.maxStack <= 0) return false;
  const qty = Math.max(0, Math.floor(Number(row.quantity) || 0));
  return qty >= meta.maxStack;
}

/** 商城货架行钱包不足以购买×1（与 CLIENT-154/092 口径一致）。 */
export function isShopOfferWalletInsufficient(
  wallet: ResourceWallet | undefined,
  offer: ShopOfferRow,
  purchaseCount = 1,
): boolean {
  if (offer.sold_out) return false;
  return shopOfferAffordInlineForRow(wallet, offer, purchaseCount) != null;
}

export function shouldBagShopInlineStateResidualRing(
  panel: BagShopInlineStateResidualPanel,
  row: BagStack | null | undefined,
  wallet: ResourceWallet | undefined,
  offer: ShopOfferRow | null | undefined,
): boolean {
  if (panel === "bag") {
    return row != null && isBagStackAtCap(row);
  }
  return offer != null && isShopOfferWalletInsufficient(wallet, offer, 1);
}

export function findBagShopInlineStateResidualTarget(
  rowEl: HTMLElement | null | undefined,
  panel: BagShopInlineStateResidualPanel,
): HTMLElement | null {
  if (!rowEl) return null;
  if (panel === "bag") {
    return rowEl.querySelector<HTMLElement>(`.${BAG_ROW_INLINE_STATE_CLASS}`) ?? rowEl;
  }
  return (
    rowEl.querySelector<HTMLElement>(`.${SHOP_OFFER_AFFORD_INLINE_CLASS}`) ??
    rowEl.querySelector<HTMLElement>(`.${SHOP_PRICE_WALLET_GAP_LINE_CLASS}`) ??
    rowEl
  );
}

export function clearBagShopInlineStateResidualRing(root: ParentNode | null | undefined): void {
  if (!root) return;
  root
    .querySelectorAll<HTMLElement>(`.${BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS}`)
    .forEach((el) => el.classList.remove(BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS));
}

/** 行内态元素附加 `bag-shop-inline-state-residual-ring` 1.5s。 */
export function scheduleBagShopInlineStateResidualRing(
  target: HTMLElement | null | undefined,
  panelRoot: ParentNode | null | undefined = null,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = BAG_SHOP_INLINE_STATE_RESIDUAL_RING_MS,
): boolean {
  if (!target) return false;
  if (inlineStateResidualRingTimer != null) {
    windowObj.clearTimeout(inlineStateResidualRingTimer);
    inlineStateResidualRingTimer = null;
  }
  clearBagShopInlineStateResidualRing(panelRoot ?? target.closest(".content-panel"));
  target.classList.add(BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS);
  void target.offsetWidth;
  inlineStateResidualRingTimer = windowObj.setTimeout(() => {
    target.classList.remove(BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS);
    inlineStateResidualRingTimer = null;
  }, durationMs);
  return true;
}
