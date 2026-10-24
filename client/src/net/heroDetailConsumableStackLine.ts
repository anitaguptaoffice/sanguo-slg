import { bagStackQuantity, type BagStack } from "@/net/bagState";
import { itemLabel } from "@/net/contentFormat";
import { HERO_CULTIVATION_CONSUMABLE_CFG_IDS, type HeroDetail } from "@/net/heroMailState";
import {
  evaluateHeroUpgradeItemGap,
  resolveHeroLevelUpgradeItemNeed,
  resolveHeroLoyaltyUpgradeItemNeed,
} from "@/net/heroUpgradeItemGap";

/** CLIENT-213：详情养成区堆叠扫读行 DOM class。 */
export const HERO_DETAIL_CONSUMABLE_STACK_LINE_CLASS = "hero-detail-consumable-stack-line";

export const HERO_DETAIL_CONSUMABLE_STACK_LINE_ROLE = "hero-detail-consumable-stack-line";

type CultivationNeedParts = {
  levelQty: number;
  loyaltyQty: number;
};

function addNeed(
  map: Map<number, CultivationNeedParts>,
  itemCfgId: number,
  kind: "level" | "loyalty",
  quantity: number,
): void {
  if (itemCfgId <= 0 || quantity <= 0) return;
  const prev = map.get(itemCfgId) ?? { levelQty: 0, loyaltyQty: 0 };
  if (kind === "level") prev.levelQty += quantity;
  else prev.loyaltyQty += quantity;
  map.set(itemCfgId, prev);
}

function collectCultivationNeeds(
  detail: HeroDetail,
): Map<number, CultivationNeedParts> {
  const map = new Map<number, CultivationNeedParts>();
  const levelNeed = resolveHeroLevelUpgradeItemNeed(detail);
  const loyaltyNeed = resolveHeroLoyaltyUpgradeItemNeed(detail);
  if (levelNeed) addNeed(map, levelNeed.itemCfgId, "level", levelNeed.quantity);
  if (loyaltyNeed) addNeed(map, loyaltyNeed.itemCfgId, "loyalty", loyaltyNeed.quantity);
  return map;
}

/**
 * 详情养成区：背包同源养成道具堆叠数 + 升级/忠诚缺口只读对比。
 * 与 CLIENT-165 `formatHeroUpgradeItemGap` 并列，不替换进度条旁缺口行。
 */
export function formatHeroDetailConsumableStackLine(
  detail: HeroDetail | null | undefined,
  bag: BagStack[],
): string | null {
  if (!detail?.hero_id) return null;

  const needs = collectCultivationNeeds(detail);
  const itemIds = new Set<number>([
    ...HERO_CULTIVATION_CONSUMABLE_CFG_IDS,
    ...needs.keys(),
  ]);

  const segments: string[] = [];
  for (const itemCfgId of [...itemIds].sort((a, b) => a - b)) {
    const owned = bagStackQuantity(bag, itemCfgId);
    const parts = needs.get(itemCfgId);
    const levelQty = parts?.levelQty ?? 0;
    const loyaltyQty = parts?.loyaltyQty ?? 0;
    const totalNeed = levelQty + loyaltyQty;
    if (owned <= 0 && totalNeed <= 0) continue;

    const name = itemLabel(itemCfgId);
    const needBits: string[] = [];
    if (levelQty > 0) needBits.push(`升级需${levelQty}`);
    if (loyaltyQty > 0) needBits.push(`忠诚需${loyaltyQty}`);

    const gap =
      totalNeed > 0
        ? evaluateHeroUpgradeItemGap({ itemCfgId, quantity: totalNeed }, bag)
        : null;

    let segment = `#${itemCfgId} ${name} 堆叠×${owned}`;
    if (needBits.length) segment += ` · ${needBits.join("/")}`;
    if (gap && !gap.sufficient) segment += ` · 缺口${gap.shortfall}`;
    else if (totalNeed > 0 && gap?.sufficient) segment += " · 充足";
    segments.push(segment);
  }

  if (!segments.length) return null;
  return `养成道具 · ${segments.join("；")}`;
}
