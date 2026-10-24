import type { BagStack } from "@/net/bagState";
import { pickHeroCultivationUseItemCfgId, validateHeroDetailCultivationUse } from "@/net/heroDetailCultivationUse";

export const HERO_GOTO_BAG_CULTIVATION_LABEL = "前往背包使用养成道具";

export type HeroDetailBagDeepLinkPick =
  | { ok: true; itemCfgId: number }
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
  return { ok: true, itemCfgId };
}

export function scrollBagItemRowIntoView(panel: ParentNode | null | undefined, itemCfgId: number): boolean {
  if (!panel || itemCfgId <= 0) return false;
  const row = panel.querySelector<HTMLElement>(`li[data-item-cfg-id="${itemCfgId}"]`);
  if (!row || typeof row.scrollIntoView !== "function") return false;
  row.scrollIntoView({ block: "nearest" });
  return true;
}
