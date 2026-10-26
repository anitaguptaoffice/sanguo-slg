import type { GatewayPort } from "./GatewayClient";
import { beginAssetRead } from "./questClaimAssets";

/** Invalidate reads at both RPC boundaries, including hidden/unknown settlement.
 * The one-shot result preserves receipt freshness from BEFORE the settlement bump.
 * Ownership must include actor/session, not panel visibility.
 */
export function beginAssetMutation(gateway: GatewayPort, current: () => boolean): () => boolean {
  const latest = beginAssetRead(gateway);
  let pending = true;
  return () => {
    if (!pending) return false;
    pending = false;
    if (!current()) return false; // An old response cannot invalidate a new actor's reads.
    const fresh = latest();
    beginAssetRead(gateway);
    return fresh;
  };
}
