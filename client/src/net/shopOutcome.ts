import type { GatewayPort } from "./GatewayClient";
import type { MainCitySession, ResourceWallet } from "./bootstrapSession";
import { bagFromListPlayerBagResponse } from "./bagState";
import { beginAssetRead } from "./questClaimAssets";

export type ShopOffer = {
  offer_id?: number; shelf_name?: string; item_cfg_id?: number;
  quantity_per_purchase?: number; price_resources?: ResourceWallet;
  purchase_limit?: number; purchased_count?: number; sold_out?: boolean;
};
export const SHOP_UNKNOWN_OUTCOME = "购买结果未知，可能已扣费或发放道具，请勿重复提交。";
export const SHOP_CURRENT_STATE_ONLY = "仅显示当前背包、钱包与货架；初始赠送、资源结算和其他活动可能改变余额，不能据此判定上次购买结果。再次购买是新购买，不是重试。";
export const SHOP_RELOAD_FAILED = "当前资产与货架待同步，请重新加载当前状态；不会重发购买请求。";

/** Keep the old non-atomic route safe too: sold-out/item-debit failures may follow payment. */
export function isKnownShopRejection(error: unknown): boolean {
  const e = error as { code?: number; message?: string } | null;
  if ([64001, 64002, 64005, 64006].includes(e?.code ?? 0)) return true;
  return e?.code === 10001 && ["offer not found", "shop: offer not found",
    "shop: purchase_count must be positive", "shop: purchase limit exceeded"].includes(e.message ?? "");
}

/** These existing reads are current state, never a receipt or permission to replay. */
export async function readShopCurrentState(gateway: GatewayPort, getSession: () => MainCitySession | null,
  current: () => boolean) {
  const session = getSession();
  if (!session || !current()) return null;
  const { serverId, cityId, bag, wallet } = session;
  const latest = beginAssetRead(gateway);
  const [bagRes, cityRes, shelf] = await Promise.all([
    gateway.listPlayerBag(serverId) as Promise<{ items?: { item_cfg_id?: number; quantity?: number }[] }>,
    gateway.getCityState(cityId) as Promise<{ wallet?: ResourceWallet }>,
    gateway.listShopShelf(serverId) as Promise<{ offers?: ShopOffer[] }>,
  ]);
  const fresh = () => current() && latest() && getSession()?.bag === bag && getSession()?.wallet === wallet;
  if (!current()) return null;
  if (!fresh() || !cityRes.wallet) throw new Error(SHOP_RELOAD_FAILED);
  return { bag: bagFromListPlayerBagResponse(bagRes.items), wallet: cityRes.wallet, offers: shelf.offers ?? [], bagRes, fresh };
}
