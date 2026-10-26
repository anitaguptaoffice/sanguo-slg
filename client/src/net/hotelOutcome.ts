import type { GatewayPort } from "./GatewayClient";
import type { MainCitySession, ResourceWallet } from "./bootstrapSession";
import { bagFromListPlayerBagResponse } from "./bagState";
import type { HeroSummary } from "./heroMailState";
import { beginAssetRead } from "./questClaimAssets";

export const HOTEL_UNKNOWN_OUTCOME = "操作结果暂无法确认，可能已生效，请勿重复提交。请重新加载当前状态核对将领、钱包和背包。";
export const HOTEL_CURRENT_STATE_ONLY = "仅显示当前状态；客栈列表可能自然补充，背包可能触发既有初始赠送，不能据此判定上次操作结果。";
export const HOTEL_RELOAD_FAILED = "当前状态加载未完成，请重新加载当前状态；不会重发招入或访贤请求。";

/** Existing RPCs, not a receipt lookup: list may sync the pool; bag may grant starter items. */
export async function readHotelCurrentState(gateway: GatewayPort, getSession: () => MainCitySession | null,
  current: () => boolean, includePool: boolean) {
  const session = getSession();
  if (!session || !current()) return null;
  const { serverId, cityId, bag, wallet } = session;
  const latest = beginAssetRead(gateway);
  const [heroRes, bagRes, cityRes, pool] = await Promise.all([
    gateway.listPlayerHeroes(serverId) as Promise<{ heroes?: HeroSummary[] }>,
    gateway.listPlayerBag(serverId) as Promise<{ items?: { item_cfg_id?: number; quantity?: number }[] }>,
    gateway.getCityState(cityId) as Promise<{ wallet?: ResourceWallet }>,
    includePool ? gateway.listHotelRecruitCandidates(serverId, cityId) : Promise.resolve(null),
  ]);
  const fresh = () => current() && latest() && getSession()?.bag === bag && getSession()?.wallet === wallet;
  if (!current()) return null;
  if (!fresh() || !cityRes.wallet) {
    throw new Error(HOTEL_RELOAD_FAILED);
  }
  return { heroes: heroRes.heroes ?? [], bag: bagFromListPlayerBagResponse(bagRes.items), wallet: cityRes.wallet, pool, fresh };
}
