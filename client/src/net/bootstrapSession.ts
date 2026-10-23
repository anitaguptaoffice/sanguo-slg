import { ErrorCode } from "@/net/loadProto";
import type { GatewayPort } from "@/net/GatewayClient";

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
  player: PlayerProfile;
  wallet: ResourceWallet;
  cityId: number;
  cityName: string;
  buildings: CityBuilding[];
  cityTroops: CityTroopStack[];
};

type LoginResult = {
  player?: PlayerProfile;
  wallet?: ResourceWallet;
};

type CitySummary = {
  city_id?: number;
  name?: string;
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

  const list = (await gateway.listPlayerCities()) as { cities?: CitySummary[] };
  let city = list.cities?.find((c) => c.is_capital) ?? list.cities?.[0];
  if (!city?.city_id) {
    const created = (await gateway.createCity(serverId, "主城", 60, 60)) as { city?: CitySummary };
    city = created.city;
  }
  if (!city?.city_id) {
    throw new Error("无法获取城池");
  }

  const state = (await gateway.getCityState(city.city_id)) as {
    wallet?: ResourceWallet;
    buildings?: CityBuilding[];
  };

  return {
    player: login.player ?? {},
    wallet: state.wallet ?? login.wallet ?? {},
    cityId: city.city_id,
    cityName: city.name ?? "主城",
    buildings: state.buildings ?? [],
    cityTroops: [],
  };
}
