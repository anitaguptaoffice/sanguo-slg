import type { GatewayPort } from "@/net/GatewayClient";
import type { HeroSummary } from "@/net/heroMailState";
import { heroTemplateLabel } from "@/net/heroMailState";
import { normalizeListPlayerHeroSummary } from "@/net/heroListLoyaltySubline";
import { gatewayErrorMessage } from "@/net/contentFeedback";
import type { MarchSummary } from "@/net/militaryFormat";

export type CityChiefView = {
  city_id?: number;
  hero_id?: number;
  loyalty?: number;
  production_bonus?: number;
};

export type CityChiefSubmitPhase = "idle" | "loading" | "appointing" | "clearing";

export const CITY_CHIEF_HALL_SLOT_KEY = "hall";

export const CITY_CHIEF_MARCH_BLOCK_MESSAGE = "该将领正在出征，无法担任城主";

const SERVER_HERO_BUSY_SNIPPETS = ["hero not available for office", "hero: hero not available"];

export function parseCityChiefView(raw: unknown): CityChiefView {
  const o = raw as CityChiefView | null | undefined;
  return {
    city_id: o?.city_id,
    hero_id: o?.hero_id,
    loyalty: o?.loyalty,
    production_bonus: o?.production_bonus,
  };
}

export function cityChiefHasAppointee(view: CityChiefView | null | undefined): boolean {
  return (view?.hero_id ?? 0) > 0;
}

export function heroIdsOnActiveMarch(marches: MarchSummary[] | null | undefined): Set<number> {
  const ids = new Set<number>();
  for (const m of marches ?? []) {
    const phase = m.phase ?? 0;
    if (phase === 3) continue;
    const heroId = m.hero_id ?? m.leader_hero_id ?? 0;
    if (heroId > 0) ids.add(heroId);
  }
  return ids;
}

export function isHeroBlockedForCityChief(
  heroId: number,
  marchingHeroIds: ReadonlySet<number>,
): boolean {
  return marchingHeroIds.has(heroId);
}

export function formatCityChiefHeroOptionLabel(hero: HeroSummary): string {
  const name = heroTemplateLabel(hero.template_cfg_id);
  const id = hero.hero_id ?? 0;
  return `#${id} ${name} · Lv${hero.level ?? 1} · 忠诚 ${hero.loyalty ?? 0}`;
}

export function formatCityChiefCurrentLine(
  view: CityChiefView | null | undefined,
  heroes: HeroSummary[],
): string {
  const heroId = view?.hero_id ?? 0;
  if (heroId <= 0) return "现任城主：空缺";
  const hero = heroes.find((h) => h.hero_id === heroId);
  const name = hero ? heroTemplateLabel(hero.template_cfg_id) : `将领 #${heroId}`;
  const loyalty = view?.loyalty ?? hero?.loyalty;
  const loyaltyPart = loyalty != null ? ` · 忠诚 ${loyalty}` : "";
  return `现任城主：${name}（#${heroId}）${loyaltyPart}`;
}

/** 忠诚产出加成面板占位（数值面板后续接）。 */
export function formatCityChiefProductionBonusStub(
  view: CityChiefView | null | undefined,
): string {
  const bonus = view?.production_bonus;
  if (bonus == null || bonus <= 0) {
    return "内政产出加成：待城主任命后展示（只读占位）";
  }
  const pct = Math.round(bonus * 1000) / 10;
  return `内政产出加成：约 +${pct}%（只读摘要）`;
}

export function formatCityChiefGatewayError(err: unknown): string {
  const raw = gatewayErrorMessage(err);
  const lower = raw.toLowerCase();
  if (SERVER_HERO_BUSY_SNIPPETS.some((s) => lower.includes(s))) {
    const codeMatch = raw.match(/^\[(\d+)\]/);
    const suffix = codeMatch ? ` [${codeMatch[1]}]` : "";
    return `${CITY_CHIEF_MARCH_BLOCK_MESSAGE}${suffix}`;
  }
  if (lower.includes("no city chief")) {
    return "当前暂无城主，无需卸任";
  }
  return raw;
}

export function cityChiefAppointButtonDisabled(
  phase: CityChiefSubmitPhase,
  selectedHeroId: number,
  marchingHeroIds: ReadonlySet<number>,
): boolean {
  if (phase !== "idle") return true;
  if (selectedHeroId <= 0) return true;
  return isHeroBlockedForCityChief(selectedHeroId, marchingHeroIds);
}

export function cityChiefClearButtonDisabled(
  phase: CityChiefSubmitPhase,
  view: CityChiefView | null | undefined,
): boolean {
  if (phase !== "idle") return true;
  return !cityChiefHasAppointee(view);
}

export type CityOfficeBundle = {
  chief: CityChiefView;
  heroes: HeroSummary[];
  marchingHeroIds: Set<number>;
};

export async function loadCityOfficeBundle(
  gateway: GatewayPort,
  serverId: number,
  cityId: number,
  marches: MarchSummary[],
): Promise<CityOfficeBundle> {
  const [chiefRes, heroesRes] = await Promise.all([
    gateway.getCityChief(serverId, cityId),
    gateway.listPlayerHeroes(serverId, { pageSize: 80 }),
  ]);
  const heroes = ((heroesRes as { heroes?: HeroSummary[] }).heroes ?? []).map((row) =>
    normalizeListPlayerHeroSummary(row),
  );
  return {
    chief: parseCityChiefView(chiefRes),
    heroes,
    marchingHeroIds: heroIdsOnActiveMarch(marches),
  };
}

export async function runSetCityChief(
  gateway: GatewayPort,
  serverId: number,
  cityId: number,
  heroId: number,
): Promise<{ chief: CityChiefView; error: string | null }> {
  try {
    const res = await gateway.setCityChief(serverId, cityId, heroId);
    return { chief: parseCityChiefView(res), error: null };
  } catch (e) {
    return { chief: { city_id: cityId }, error: formatCityChiefGatewayError(e) };
  }
}

export async function runClearCityChief(
  gateway: GatewayPort,
  serverId: number,
  cityId: number,
): Promise<{ chief: CityChiefView; error: string | null }> {
  try {
    await gateway.clearCityChief(serverId, cityId);
    return { chief: { city_id: cityId, hero_id: 0 }, error: null };
  } catch (e) {
    return { chief: { city_id: cityId }, error: formatCityChiefGatewayError(e) };
  }
}
