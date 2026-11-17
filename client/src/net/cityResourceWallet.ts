import type { ResourceWallet } from "./bootstrapSession";

/** City/GetCityState/build/recruit wallets contain only four resources. Protobuf's gold=0
 * default is not a player-gold observation. Never use this for full player-wallet receipts.
 */
export function mergeCityResourceWallet(current: ResourceWallet, city?: ResourceWallet | null): ResourceWallet {
  if (!city) return current;
  const next = { ...current };
  for (const key of ["food", "wood", "iron", "stone"] as const) {
    if (city[key] != null) next[key] = city[key];
  }
  return next;
}
