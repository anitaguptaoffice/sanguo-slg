import type { BagStack } from "@/net/bagState";
import { categorizeBagStackRow, parseBagCategoryTabSessionValue, type BagClientCategory } from "@/net/bagCategory";
import {
  appendBagOpenSourceQuery,
  BAG_OPEN_SOURCE_QUERY_KEY,
  parseBagOpenSource,
  type BagOpenSource,
} from "@/net/bagOpenSource";
import { pickHeroCultivationUseItemCfgId, validateHeroDetailCultivationUse } from "@/net/heroDetailCultivationUse";

export const HERO_GOTO_BAG_CULTIVATION_LABEL = "前往背包使用养成道具";

/** sessionStorage：将领详情 → 背包深链 query（CLIENT-165 / CLIENT-134 模式）。 */
export const HERO_BAG_DEEP_LINK_QUERY_SESSION_KEY = "hero-bag-deep-link-query-v1";

export type HeroBagDeepLinkQuery = {
  bagCategory: BagClientCategory;
  highlightItemId: number;
  returnHeroId: number;
  openSource?: BagOpenSource;
  /** CLIENT-201：自招募表单道具缺口深链打开背包。 */
  recruitItemGap?: boolean;
};

export type HeroDetailBagDeepLinkPick =
  | { ok: true; itemCfgId: number; bagCategory: BagClientCategory }
  | { ok: false; errorMessage: string };

/** 纯函数：将领详情 → 背包首条可对该将使用的养成 consumable（既有 cfg 子集）。 */
export function pickHeroDetailBagDeepLink(heroId: number, bag: BagStack[]): HeroDetailBagDeepLinkPick {
  if (!Number.isFinite(heroId) || heroId <= 0) {
    return { ok: false, errorMessage: "请先选择将领（hero_id 不能为空）" };
  }
  const itemCfgId = pickHeroCultivationUseItemCfgId(bag);
  if (!itemCfgId) {
    return { ok: false, errorMessage: "背包暂无养成消耗品（将魂碎晶等）" };
  }
  const validated = validateHeroDetailCultivationUse(bag);
  if (!validated.ok || validated.itemCfgId !== itemCfgId) {
    return { ok: false, errorMessage: validated.message || "暂无法对该将领使用养成道具" };
  }
  const row = bag.find((b) => b.item_cfg_id === itemCfgId) ?? { item_cfg_id: itemCfgId, quantity: 0 };
  const bagCategory = categorizeBagStackRow(row);
  return { ok: true, itemCfgId, bagCategory };
}

export function buildHeroBagDeepLinkQuery(input: {
  highlightItemId: number;
  bagCategory?: BagClientCategory;
  returnHeroId?: number;
  openSource?: BagOpenSource;
  recruitItemGap?: boolean;
}): HeroBagDeepLinkQuery {
  const highlightItemId = Math.floor(Number(input.highlightItemId) || 0);
  const returnHeroId = Math.floor(Number(input.returnHeroId) || 0);
  const bagCategory =
    input.bagCategory ??
    (highlightItemId > 0
      ? categorizeBagStackRow({ item_cfg_id: highlightItemId, quantity: 1 })
      : "cultivation");
  return {
    bagCategory,
    highlightItemId,
    returnHeroId,
    openSource: input.openSource,
    recruitItemGap: input.recruitItemGap,
  };
}

/** 序列化深链 query（`bagCategory` / `highlightItemId` / `returnHeroId`）。 */
export function serializeHeroBagDeepLinkQuery(query: HeroBagDeepLinkQuery): string {
  const params = new URLSearchParams();
  if (query.bagCategory && query.bagCategory !== "all") {
    params.set("bagCategory", query.bagCategory);
  }
  if (query.highlightItemId > 0) {
    params.set("highlightItemId", String(query.highlightItemId));
  }
  if (query.returnHeroId > 0) {
    params.set("returnHeroId", String(query.returnHeroId));
  }
  if (query.openSource) {
    appendBagOpenSourceQuery(params, query.openSource);
  }
  if (query.recruitItemGap) {
    params.set("recruitItemGap", "1");
  }
  return params.toString();
}

/** 解析深链 query 字符串或 URLSearchParams。 */
export function parseHeroBagDeepLinkQuery(
  raw: string | URLSearchParams | null | undefined,
): HeroBagDeepLinkQuery | null {
  if (raw == null || raw === "") return null;
  const params = typeof raw === "string" ? new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw) : raw;
  const highlightItemId = Number(params.get("highlightItemId") ?? params.get("highlight_item_id") ?? 0);
  if (!Number.isFinite(highlightItemId) || highlightItemId <= 0) return null;
  const categoryRaw = params.get("bagCategory") ?? params.get("bag_category");
  const bagCategory =
    parseBagCategoryTabSessionValue(categoryRaw) ??
    categorizeBagStackRow({ item_cfg_id: Math.floor(highlightItemId), quantity: 1 });
  const returnHeroId = Number(params.get("returnHeroId") ?? params.get("return_hero_id") ?? 0);
  const openSource = parseBagOpenSource(params.get(BAG_OPEN_SOURCE_QUERY_KEY));
  const recruitItemGap = params.get("recruitItemGap") === "1";
  return buildHeroBagDeepLinkQuery({
    highlightItemId: Math.floor(highlightItemId),
    bagCategory,
    returnHeroId: Number.isFinite(returnHeroId) && returnHeroId > 0 ? Math.floor(returnHeroId) : 0,
    openSource: openSource ?? undefined,
    recruitItemGap: recruitItemGap || undefined,
  });
}

export function writeHeroBagDeepLinkQuerySession(
  query: HeroBagDeepLinkQuery,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined" ? sessionStorage : null,
): void {
  try {
    storage?.setItem(HERO_BAG_DEEP_LINK_QUERY_SESSION_KEY, serializeHeroBagDeepLinkQuery(query));
  } catch {
    /* quota */
  }
}

export function readHeroBagDeepLinkQuerySession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined" ? sessionStorage : null,
): HeroBagDeepLinkQuery | null {
  try {
    return parseHeroBagDeepLinkQuery(storage?.getItem(HERO_BAG_DEEP_LINK_QUERY_SESSION_KEY) ?? null);
  } catch {
    return null;
  }
}

export function clearHeroBagDeepLinkQuerySession(
  storage: Pick<Storage, "removeItem"> | null = typeof sessionStorage !== "undefined" ? sessionStorage : null,
): void {
  try {
    storage?.removeItem(HERO_BAG_DEEP_LINK_QUERY_SESSION_KEY);
  } catch {
    /* private mode */
  }
}

export function scrollBagItemRowIntoView(panel: ParentNode | null | undefined, itemCfgId: number): boolean {
  if (!panel || itemCfgId <= 0) return false;
  const row = panel.querySelector<HTMLElement>(`li[data-item-cfg-id="${itemCfgId}"]`);
  if (!row || typeof row.scrollIntoView !== "function") return false;
  row.scrollIntoView({ block: "nearest" });
  return true;
}
