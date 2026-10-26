import { positivePlayerLevel } from "./tutorialPlayerLevel";
import { garrisonPatch } from "@/net/garrisonState";
import { ErrorCode } from "@/net/loadProto";
import type { GatewayPort } from "@/net/GatewayClient";
import type { BagStack } from "@/net/bagState";

export type ResourceWallet = {
  food?: number;
  wood?: number;
  iron?: number;
  stone?: number;
  gold?: number;
};

export type CityBuilding = {
  slot_key?: string;
  building_cfg_id?: number;
  level?: number;
  upgrade_finish_at_ms?: number;
};

export type PlayerProfile = {
  server_id?: number;
  player_id?: number;
  display_name?: string;
  level?: number;
  power?: number;
};

export type CityTroopStack = {
  unit_cfg_id?: number;
  count?: number;
  wounded?: number;
};

export type MainCitySession = {
  serverId: number;
  player: PlayerProfile;
  wallet: ResourceWallet;
  /** GetCityState.production_rates（粮/木/铁/石 每小时净产出，只读）。 */
  productionRates?: ResourceWallet;
  cityId: number;
  cityName: string;
  /** 世界格点坐标（ListPlayerCities / CreateCity）。 */
  cityX?: number;
  cityY?: number;
  buildings: CityBuilding[];
  cityTroops: CityTroopStack[];
  garrisonStatus?: "unknown" | "stale" | "ready";
  bag: BagStack[];
};

type LoginResult = {
  player?: PlayerProfile;
  wallet?: ResourceWallet;
};

type CitySummary = {
  city_id?: number;
  name?: string;
  x?: number;
  y?: number;
  is_capital?: boolean;
};

function gatewayCode(err: unknown): number | undefined {
  if (err && typeof err === "object" && "code" in err && typeof (err as { code: number }).code === "number") {
    return (err as { code: number }).code;
  }
  return undefined;
}

/** 注册（若需要）→ 登录 → 确保有城池 → 拉取内政状态。 */
export async function bootstrapMainCity(
  gateway: GatewayPort,
  loginName: string,
  password: string,
  serverId: number,
): Promise<MainCitySession> {
  let login: LoginResult;
  try {
    login = (await gateway.login(loginName, password, serverId)) as LoginResult;
  } catch (e) {
    const code = gatewayCode(e);
    if (code === ErrorCode.ACCOUNT_LOGIN_FAILED) {
      await gateway.register(loginName, password);
      login = (await gateway.login(loginName, password, serverId)) as LoginResult;
    } else {
      throw e;
    }
  }

  const entered = await gateway.enterGameServer(serverId) as LoginResult;
  const generation = gateway.getSessionGeneration?.();
  const token = gateway.getSessionId?.();
  const assertCurrent = () => {
    if (generation !== gateway.getSessionGeneration?.() || token !== gateway.getSessionId?.()) {
      throw new Error("会话已变更，请重新进入游戏");
    }
  };
  // Fresh profile initializes this actor. Never carry a prior actor's maximum level.
  const profile = entered.player ?? login.player ?? {};
  if (profile.server_id && profile.server_id !== serverId) throw new Error("角色与游戏服不匹配");
  if (entered.player?.player_id && login.player?.player_id && entered.player.player_id !== login.player.player_id) {
    throw new Error("角色已变更，请重新进入游戏");
  }

  const list = (await gateway.listPlayerCities()) as { cities?: CitySummary[] };
  assertCurrent();
  let city = list.cities?.find((c) => c.is_capital) ?? list.cities?.[0];
  if (!city?.city_id) {
    const created = (await gateway.createCity(serverId, "主城", 60, 60)) as { city?: CitySummary };
    assertCurrent();
    city = created.city;
  }
  if (!city?.city_id) {
    throw new Error("无法获取城池");
  }

  const state = (await gateway.getCityState(city.city_id)) as {
    wallet?: ResourceWallet;
    buildings?: CityBuilding[];
    production_rates?: ResourceWallet;
    garrison?: unknown;
  };

  assertCurrent();
  return {
    serverId,
    player: { ...profile, level: positivePlayerLevel(profile.level) ?? 1 },
    wallet: state.wallet ?? entered.wallet ?? login.wallet ?? {},
    productionRates: state.production_rates,
    cityId: city.city_id,
    cityName: city.name ?? "主城",
    cityX: city.x ?? 60,
    cityY: city.y ?? 60,
    buildings: state.buildings ?? [],
    ...garrisonPatch({ cityTroops: [], garrisonStatus: "unknown" }, state.garrison),
    bag: [],
  };
}
