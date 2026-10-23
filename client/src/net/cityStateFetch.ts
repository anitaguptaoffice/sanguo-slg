import type { CityBuilding, ResourceWallet } from "@/net/bootstrapSession";
import type { GatewayPort } from "@/net/GatewayClient";

export type CityStateSnapshot = {
  wallet?: ResourceWallet;
  buildings?: CityBuilding[];
  production_rates?: ResourceWallet;
};

/** GetCityState 单飞：同一 city 在 in-flight 期间复用同一 Promise。 */
export class CityStateFetch {
  private inflight: Promise<CityStateSnapshot> | null = null;
  private inflightCityId = 0;

  constructor(
    private readonly gateway: GatewayPort,
    private readonly getCityId: () => number | null,
  ) {}

  async fetch(): Promise<CityStateSnapshot | null> {
    const cityId = this.getCityId();
    if (!cityId) return null;
    if (this.inflight && this.inflightCityId === cityId) {
      return this.inflight;
    }
    this.inflightCityId = cityId;
    const p = this.gateway.getCityState(cityId).then((raw) => raw as CityStateSnapshot);
    this.inflight = p;
    void p.finally(() => {
      if (this.inflight === p) this.inflight = null;
    });
    return p;
  }

  clear(): void {
    this.inflight = null;
    this.inflightCityId = 0;
  }
}
