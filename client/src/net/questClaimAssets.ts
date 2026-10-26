import { applyClaimPlayerLevel, PROFILE_REENTRY_HINT } from "./tutorialPlayerLevel";
import type { GatewayPort } from "./GatewayClient";
import type { MainCitySession, ResourceWallet } from "./bootstrapSession";
import { captureActor } from "./actorContext";
import { bagFromListPlayerBagResponse } from "./bagState";

const assetReads = new WeakMap<GatewayPort, number>();
export function beginAssetRead(gateway: GatewayPort): () => boolean {
  const version = (assetReads.get(gateway) ?? 0) + 1;
  assetReads.set(gateway, version);
  return captureAssetRead(gateway);
}
export function captureAssetRead(gateway: GatewayPort): () => boolean {
  const version = assetReads.get(gateway);
  return () => assetReads.get(gateway) === version;
}
export const QUEST_ASSETS_PENDING = "资产待同步，请刷新背包和主城后重试";

/** Replace authenticated snapshots atomically. Never add a receipt's granted_rewards. */
export async function refreshQuestAssets(gateway: GatewayPort, getSession: () => MainCitySession | null,
  patch: (value: Partial<MainCitySession>) => void, current = captureActor(gateway, getSession)): Promise<boolean> {
  const session = getSession();
  if (!session || !current()) return false;
  const { bag, wallet, cityId, serverId } = session;
  const latest = beginAssetRead(gateway);
  try {
    const [bagRes, state] = await Promise.all([
      gateway.listPlayerBag(serverId) as Promise<{ items?: { item_cfg_id?: number; quantity?: number }[] }>,
      gateway.getCityState(cityId) as Promise<{ wallet?: ResourceWallet }>,
    ]);
    if (!current()) return false;
    if (!latest() || getSession()?.bag !== bag || getSession()?.wallet !== wallet || !state.wallet) {
      throw new Error(QUEST_ASSETS_PENDING);
    }
    patch({ bag: bagFromListPlayerBagResponse(bagRes.items), wallet: state.wallet });
    return true;
  } catch {
    if (!current()) return false;
    throw new Error(QUEST_ASSETS_PENDING);
  }
}

export async function claimQuestWithAssets(gateway: GatewayPort, id: number,
  getSession: () => MainCitySession | null, patch: (value: Partial<MainCitySession>) => void): Promise<unknown> {
  const current = captureActor(gateway, getSession);
  const session = getSession();
  if (!session) return null;
  let response: unknown;
  try {
    response = await gateway.claimQuestReward(session.serverId, id);
  } catch (error) {
    if (!current()) return null;
    if (id >= 1001 && id <= 1006) {
      error = Object.assign(new Error(`${(error as Error).message}；${PROFILE_REENTRY_HINT}`), { code: (error as { code?: number }).code });
    }
    // A failed response may follow a persisted grant. Recover snapshots, not the claim.
    try { await refreshQuestAssets(gateway, getSession, patch, current); }
    catch { throw Object.assign(new Error(`${(error as Error).message}；${QUEST_ASSETS_PENDING}`), { code: (error as { code?: number }).code }); }
    if (!current()) return null;
    throw error;
  }
  applyClaimPlayerLevel(response, getSession, patch, current);
  if (!current() || !await refreshQuestAssets(gateway, getSession, patch, current)) return null;
  return response;
}
