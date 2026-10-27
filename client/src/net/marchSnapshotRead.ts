import type { GatewayPort } from "./GatewayClient";

const reads = new WeakMap<GatewayPort, { issued: number; applied: number }>();

/** Shared response watermark: slow polling may apply until a newer response wins. */
export function beginMarchSnapshotRead(gateway: GatewayPort, getCityId: () => number | undefined): (apply?: boolean) => boolean {
  const state = reads.get(gateway) ?? { issued: 0, applied: 0 };
  reads.set(gateway, state);
  const version = ++state.issued;
  const city = getCityId(), token = gateway.getSessionId?.();
  const generation = gateway.getSessionGeneration?.(), server = gateway.getBoundServerId?.();
  return (apply = false) => {
    if (version < state.applied || getCityId() !== city || gateway.getSessionId?.() !== token ||
      gateway.getSessionGeneration?.() !== generation || gateway.getBoundServerId?.() !== server) return false;
    if (apply) state.applied = version;
    return true;
  };
}
