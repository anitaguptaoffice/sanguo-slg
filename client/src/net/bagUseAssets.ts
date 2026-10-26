import type { GatewayPort } from "./GatewayClient";
import type { MainCitySession, ResourceWallet } from "./bootstrapSession";
import { applyUseResult } from "./bagState";
import { refreshQuestAssets } from "./questClaimAssets";

import { beginAssetMutation } from "./assetMutation";

export const BAG_USE_UNKNOWN = "结果未知，可能已扣除道具；已停止后续使用，请刷新背包核对当前背包与钱包，勿直接重试。";
export type BagUseResponse = { remaining?: number; wallet_after?: ResourceWallet; effect_summary?: string; speedup_seconds?: number };

/** One mutation only. Never retry it; a confirmed result survives a read failure. */
export async function useBagItemWithAssets(gateway: GatewayPort, itemId: number, count: number,
  getSession: () => MainCitySession | null, patch: (value: Partial<MainCitySession>) => void,
  current: () => boolean): Promise<{ response: BagUseResponse; synced: boolean } | null> {
  const session = getSession();
  if (!session || !current()) return null;
  const { bag, wallet, serverId } = session;
  const settle = beginAssetMutation(gateway, current);
  let response: BagUseResponse;
  let fresh = false;
  try { response = await gateway.useConsumable(serverId, itemId, count) as BagUseResponse; }
  finally { fresh = settle(); }
  if (!current()) return null;
  if (fresh && getSession()?.bag === bag && getSession()?.wallet === wallet) {
    patch({ bag: applyUseResult(bag, itemId, response.remaining ?? 0), wallet: response.wallet_after ?? wallet });
    return { response, synced: true };
  }
  // A newer read/write overtook this receipt: do not replace its snapshots.
  try { return { response, synced: await refreshQuestAssets(gateway, getSession, patch, current) }; }
  catch { return { response, synced: false }; }
}
