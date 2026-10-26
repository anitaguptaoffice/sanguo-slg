import { captureAssetRead } from "./questClaimAssets";
import type { CityBuilding, ResourceWallet } from "@/net/bootstrapSession";
import type { GatewayPort } from "@/net/GatewayClient";

export type CityStateSnapshot = {
  wallet?: ResourceWallet;
  buildings?: CityBuilding[];
  production_rates?: ResourceWallet;
  garrison?: unknown;
};

/** GetCityState 单飞：同一 city 在 in-flight 期间复用同一 Promise。 */
export class CityStateFetch {
  private inflight: Promise<CityStateSnapshot | null> | null = null;
  private inflightKey = "";
  private inflightAssetsCurrent = () => false;
  private generation = 0;
  private owners = new WeakMap<object, { key: string; generation: number; assetsCurrent: () => boolean }>();

  constructor(
    private readonly gateway: GatewayPort,
    private readonly getCityId: () => number | null,
    private readonly getSessionKey: () => string = () => "",
  ) {}

  async fetch(): Promise<CityStateSnapshot | null> {
    const cityId = this.getCityId();
    if (!cityId) return null;
    const key = `${this.gateway.getSessionGeneration?.()}:${this.getSessionKey()}:${cityId}`;
    const generation = this.generation;
    if (this.inflight && this.inflightKey === key && this.inflightAssetsCurrent()) {
      return this.inflight;
    }
    const assetsCurrent = captureAssetRead(this.gateway);
    this.inflightAssetsCurrent = assetsCurrent;
    this.inflightKey = key;
    const p = this.gateway.getCityState(cityId).then((raw) => {
      const state = { ...raw as CityStateSnapshot };
      this.owners.set(state, { key, generation, assetsCurrent });
      return this.isCurrent(state) ? state : null;
    });
    this.inflight = p;
    const release = () => { if (this.inflight === p) this.inflight = null; };
    void p.then(release, release);
    return p;
  }

  /** Re-check at consumption: a mutation may settle after decoding but before await resumes. */
  isCurrent(state: CityStateSnapshot): boolean {
    const owner = this.owners.get(state);
    return owner?.assetsCurrent() === true && owner.generation === this.generation &&
      owner.key === `${this.gateway.getSessionGeneration?.()}:${this.getSessionKey()}:${this.getCityId()}`;
  }

  clear(): void {
    this.inflight = null;
    this.inflightKey = "";
    this.generation++;
  }
}
