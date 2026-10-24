import type { ResourceWallet } from "@/net/bootstrapSession";
import { buildingCfgIdForSlot } from "@/net/dailyQuestQueueMatch";
import {
  BUILDING_UPGRADE_COST_GROWTH,
  BUILDING_UPGRADE_TIME_GROWTH,
  buildingUpgradeSpecForCfgId,
  type BuildingUpgradeResourceCost,
} from "@/net/buildingUpgradeCatalog";
import { formatBuildUpgradeCostLine } from "@/net/buildUpgradeCostLine";
import { formatResourceAmount, WALLET_RESOURCE_KEYS } from "@/net/hudFormat";

const BUILD_RESOURCE_KEYS = WALLET_RESOURCE_KEYS.filter(({ key }) => key !== "gold");

export type UpgradeCostPreview = {
  slotKey: string;
  buildingCfgId: number;
  currentLevel: number;
  targetLevel: number;
  cost: BuildingUpgradeResourceCost;
  timeSec: number;
  canAfford: boolean;
  /** CLIENT-067 口径：资源不足时为「缺少：粮 N …」；足够时为 null。 */
  insufficientHint: string | null;
  /** 只读摘要行（含耗时）。 */
  summaryLine: string;
};

export function computeUpgradeCostAtLevel(
  buildingCfgId: number,
  targetLevel: number,
): { cost: BuildingUpgradeResourceCost; timeSec: number } | null {
  if (targetLevel < 1) return null;
  const spec = buildingUpgradeSpecForCfgId(buildingCfgId);
  if (!spec) return null;
  const exp = targetLevel - 1;
  const costMul = BUILDING_UPGRADE_COST_GROWTH ** exp;
  const timeMul = BUILDING_UPGRADE_TIME_GROWTH ** exp;
  const scale = (v: number) => Math.floor(v * costMul);
  const c = spec.baseCost;
  return {
    cost: {
      food: scale(c.food),
      wood: scale(c.wood),
      stone: scale(c.stone),
      iron: scale(c.iron),
    },
    timeSec: Math.floor(spec.baseTimeSec * timeMul),
  };
}

/** 升级耗时只读文案（不含「剩」前缀）。 */
export function formatUpgradeDurationSec(timeSec: number): string {
  const sec = Math.max(0, Math.floor(timeSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

function costToWallet(cost: BuildingUpgradeResourceCost): ResourceWallet {
  return { food: cost.food, wood: cost.wood, stone: cost.stone, iron: cost.iron };
}

function formatCostParts(cost: BuildingUpgradeResourceCost): string[] {
  return BUILD_RESOURCE_KEYS
    .map(({ key, label }) => {
      const n = cost[key as keyof BuildingUpgradeResourceCost] ?? 0;
      if (n <= 0) return null;
      return `${label} ${formatResourceAmount(n)}`;
    })
    .filter((p): p is string => p != null);
}

export function formatUpgradeInsufficientHint(
  wallet: ResourceWallet | undefined,
  cost: BuildingUpgradeResourceCost,
): string | null {
  const parts: string[] = [];
  for (const { key, label } of BUILD_RESOURCE_KEYS) {
    const need = cost[key as keyof BuildingUpgradeResourceCost] ?? 0;
    if (need <= 0) continue;
    const have = wallet?.[key] ?? 0;
    if (have < need) {
      parts.push(`${label} ${formatResourceAmount(need - have)}`);
    }
  }
  if (!parts.length) return null;
  return `缺少：${parts.join(" · ")}`;
}

export function formatUpgradeCostSummaryLine(
  targetLevel: number,
  cost: BuildingUpgradeResourceCost,
  timeSec: number,
): string {
  return formatBuildUpgradeCostLine(targetLevel, cost, undefined, { timeSec }).textLine;
}

/**
 * 纯函数：下一级（current level → level+1）消耗/耗时与钱包对比；不发 StartBuildingUpgrade。
 * @param slot 主城 slot_key
 * @param level 当前建筑等级（未建造为 0）
 */
export function previewUpgradeCost(
  slot: string,
  level: number,
  wallet: ResourceWallet | undefined,
): UpgradeCostPreview | null {
  const slotKey = slot.trim();
  const buildingCfgId = buildingCfgIdForSlot(slotKey);
  if (buildingCfgId <= 0) return null;
  const currentLevel = Math.max(0, Math.floor(level));
  const targetLevel = currentLevel + 1;
  const computed = computeUpgradeCostAtLevel(buildingCfgId, targetLevel);
  if (!computed) return null;
  const { cost, timeSec } = computed;
  const insufficientHint = formatUpgradeInsufficientHint(wallet, cost);
  const canAfford = insufficientHint == null;
  return {
    slotKey,
    buildingCfgId,
    currentLevel,
    targetLevel,
    cost,
    timeSec,
    canAfford,
    insufficientHint,
    summaryLine: formatUpgradeCostSummaryLine(targetLevel, cost, timeSec),
  };
}

/** 单测/面板：对比钱包是否可负担给定 cost。 */
export function walletCanAffordUpgradeCost(
  wallet: ResourceWallet | undefined,
  cost: BuildingUpgradeResourceCost,
): boolean {
  return formatUpgradeInsufficientHint(wallet, cost) == null;
}

export { costToWallet };
