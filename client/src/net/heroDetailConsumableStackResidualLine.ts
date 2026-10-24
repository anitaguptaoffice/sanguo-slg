import { bagStackQuantity, type BagStack } from "@/net/bagState";
import type { HeroDetail } from "@/net/heroMailState";
import { formatHeroDetailConsumableStackLine } from "@/net/heroDetailConsumableStackLine";
import {
  evaluateHeroUpgradeItemGap,
  resolveHeroLevelUpgradeItemNeed,
  resolveHeroLoyaltyUpgradeItemNeed,
} from "@/net/heroUpgradeItemGap";

/** CLIENT-246：详情养成堆叠残余扫读行 DOM class（CLIENT-213 主行 **不退化**）。 */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_LINE_CLASS =
  "hero-detail-consumable-stack-residual-line";

export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_LINE_ROLE =
  "hero-detail-consumable-stack-residual-line";

export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEFICIT_CLASS =
  "hero-detail-consumable-stack-residual-deficit";

export type HeroDetailConsumableStackResidualLine = {
  text: string;
  hasDeficit: boolean;
};

function collectCombinedNeedQty(detail: HeroDetail): Map<number, number> {
  const map = new Map<number, number>();
  const levelNeed = resolveHeroLevelUpgradeItemNeed(detail);
  const loyaltyNeed = resolveHeroLoyaltyUpgradeItemNeed(detail);
  if (levelNeed) {
    map.set(levelNeed.itemCfgId, (map.get(levelNeed.itemCfgId) ?? 0) + levelNeed.quantity);
  }
  if (loyaltyNeed) {
    map.set(
      loyaltyNeed.itemCfgId,
      (map.get(loyaltyNeed.itemCfgId) ?? 0) + loyaltyNeed.quantity,
    );
  }
  return map;
}

/**
 * 详情养成区 **残余** 扫读：主行堆叠文案 + 背包持有/总需/缺口只读汇总（CLIENT-246；**非** ART-012）。
 */
export function formatHeroDetailConsumableStackResidualLine(
  detail: HeroDetail | null | undefined,
  bag: BagStack[],
): HeroDetailConsumableStackResidualLine | null {
  if (!detail?.hero_id) return null;
  const main = formatHeroDetailConsumableStackLine(detail, bag);
  if (!main) return null;

  const needs = collectCombinedNeedQty(detail);
  if (!needs.size) return null;

  let hasDeficit = false;
  let totalShortfall = 0;
  const bits: string[] = [];
  for (const [itemCfgId, qty] of [...needs.entries()].sort((a, b) => a[0] - b[0])) {
    const owned = bagStackQuantity(bag, itemCfgId);
    const gap = evaluateHeroUpgradeItemGap({ itemCfgId, quantity: qty }, bag);
    if (gap && !gap.sufficient) {
      hasDeficit = true;
      totalShortfall += gap.shortfall;
    }
    bits.push(`#${itemCfgId} 持${owned}/需${qty}`);
  }

  let text = `堆叠残余 · ${bits.join(" · ")}`;
  if (hasDeficit) text += ` · 总缺口${totalShortfall}`;
  else text += " · 充足";
  if (main.includes("缺口")) {
    text += " · 对照主行有缺口";
  } else if (main.includes("充足")) {
    text += " · 对照主行充足";
  }
  return { text, hasDeficit };
}
