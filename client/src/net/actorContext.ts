import type { MainCitySession } from "./bootstrapSession";
import type { GatewayPort } from "./GatewayClient";

/** Capture primitives, not a mutable player object; generation rejects same-actor relogins. */
export function captureActor(gateway: GatewayPort, getSession: () => MainCitySession | null): () => boolean {
  const session = getSession();
  const server = session?.serverId;
  const player = session?.player?.player_id;
  const city = session?.cityId;
  const token = gateway.getSessionId?.();
  const generation = gateway.getSessionGeneration?.();
  const boundServer = gateway.getBoundServerId?.();
  return () => {
    const current = getSession();
    return current?.serverId === server && current?.player?.player_id === player && current?.cityId === city &&
      gateway.getSessionId?.() === token && gateway.getSessionGeneration?.() === generation &&
      gateway.getBoundServerId?.() === boundServer;
  };
}
