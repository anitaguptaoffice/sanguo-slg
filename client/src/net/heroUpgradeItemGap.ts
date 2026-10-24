import { bagStackQuantity, type BagStack } from "@/net/bagState";
import { itemLabel } from "@/net/contentFormat";
import type { HeroDetail } from "@/net/heroMailState";

/** DATA-001 养成消耗品子集（与 `HERO_CULTIVATION_CONSUMABLE_CFG_IDS` 对齐，避免循环依赖）。 */
const DEFAULT_UPGRADE_ITEM_CFG_ID = 2017;

export type HeroUpgradeItemNeed = {
  itemCfgId: number;
  quantity: number;
};

export type HeroUpgradeItemGap = {
  need: HeroUpgradeItemNeed;
  owned: number;
  shortfall: number;
  sufficient: boolean;
  text: string;
};

function parseItemNeedField(raw: unknown): HeroUpgradeItemNeed | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const itemCfgId = Number(r.item_cfg_id ?? r.itemCfgId ?? 0);
  const quantity = Number(r.quantity ?? r.qty ?? 0);
  if (!Number.isFinite(itemCfgId) || itemCfgId <= 0) return null;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  return { itemCfgId: Math.floor(itemCfgId), quantity: Math.floor(quantity) };
}

/** 从 GetHeroDetail 可选字段或客户端子集推导「升级」道具需求（只读，不发 RPC）。 */
export function resolveHeroLevelUpgradeItemNeed(detail: HeroDetail | null | undefined): HeroUpgradeItemNeed | null {
  if (!detail?.hero_id) return null;
  const fromGateway =
    parseItemNeedField(detail.level_upgrade_item) ??
    parseItemNeedField((detail as { level_up_item?: unknown }).level_up_item);
  if (fromGateway) return fromGateway;
  const expMax = detail.exp_to_next;
  if (expMax != null && expMax <= 0) return null;
  return { itemCfgId: DEFAULT_UPGRADE_ITEM_CFG_ID, quantity: 1 };
}

/** 从 GetHeroDetail 可选字段或忠诚上限推导「忠诚」道具需求。 */
export function resolveHeroLoyaltyUpgradeItemNeed(
  detail: HeroDetail | null | undefined,
): HeroUpgradeItemNeed | null {
  if (!detail?.hero_id) return null;
  const fromGateway =
    parseItemNeedField(detail.loyalty_upgrade_item) ??
    parseItemNeedField((detail as { loyalty_up_item?: unknown }).loyalty_up_item);
  if (fromGateway) return fromGateway;
  const loyalty = detail.loyalty ?? 0;
  const max = detail.loyalty_max;
  if (max == null || loyalty >= max) return null;
  return { itemCfgId: DEFAULT_UPGRADE_ITEM_CFG_ID, quantity: 1 };
}

/** 纯函数：道具 id + 数量 vs 背包快照缺口文案。 */
export function formatHeroUpgradeItemGap(
  need: HeroUpgradeItemNeed | null | undefined,
  bag: BagStack[],
): string | null {
  if (!need || need.itemCfgId <= 0 || need.quantity <= 0) return null;
  const gap = evaluateHeroUpgradeItemGap(need, bag);
  return gap.text;
}

export function evaluateHeroUpgradeItemGap(
  need: HeroUpgradeItemNeed,
  bag: BagStack[],
): HeroUpgradeItemGap {
  const owned = bagStackQuantity(bag, need.itemCfgId);
  const shortfall = Math.max(0, need.quantity - owned);
  const sufficient = shortfall === 0;
  const name = itemLabel(need.itemCfgId);
  const base = `#${need.itemCfgId} ${name} 需${need.quantity}/持${owned}`;
  const text = sufficient ? base : `${base} 缺口${shortfall}`;
  return { need, owned, shortfall, sufficient, text };
}

/** 升级/忠诚区任一道具不足时的主按钮禁用文案（多项以；连接）。 */
export function heroUpgradeItemGapDisabledReason(
  detail: HeroDetail | null | undefined,
  bag: BagStack[],
): string | null {
  const parts: string[] = [];
  const levelNeed = resolveHeroLevelUpgradeItemNeed(detail);
  const loyaltyNeed = resolveHeroLoyaltyUpgradeItemNeed(detail);
  if (levelNeed) {
    const gap = evaluateHeroUpgradeItemGap(levelNeed, bag);
    if (!gap.sufficient) parts.push(`升级 ${gap.text}`);
  }
  if (loyaltyNeed) {
    const gap = evaluateHeroUpgradeItemGap(loyaltyNeed, bag);
    if (!gap.sufficient) parts.push(`忠诚 ${gap.text}`);
  }
  return parts.length ? parts.join("；") : null;
}
