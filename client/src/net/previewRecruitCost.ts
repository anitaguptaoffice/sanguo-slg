import type { ResourceWallet } from "@/net/bootstrapSession";
import { formatResourceAmount, WALLET_RESOURCE_KEYS } from "@/net/hudFormat";
import { unitLabel } from "@/net/militaryFormat";
import {
  formatUpgradeDurationSec,
  formatUpgradeInsufficientHint,
} from "@/net/previewUpgradeCost";
import {
  scaleTroopRecruitCost,
  troopRecruitSpecForCfgId,
  type TroopRecruitResourceCost,
} from "@/net/troopRecruitCatalog";

const BUILD_RESOURCE_KEYS = WALLET_RESOURCE_KEYS.filter(({ key }) => key !== "gold");

export type RecruitCostPreview = {
  troopCfgId: number;
  qty: number;
  cost: TroopRecruitResourceCost;
  timeSec: number;
  canAfford: boolean;
  /** CLIENT-067 口径：资源不足时为「缺少：粮 N …」；足够时为 null。 */
  insufficientHint: string | null;
  /** 只读摘要行（含耗时，与建造升级预览同级）。 */
  summaryLine: string;
};

function formatCostParts(cost: TroopRecruitResourceCost): string[] {
  return BUILD_RESOURCE_KEYS
    .map(({ key, label }) => {
      const n = cost[key as keyof TroopRecruitResourceCost] ?? 0;
      if (n <= 0) return null;
      return `${label} ${formatResourceAmount(n)}`;
    })
    .filter((p): p is string => p != null);
}

export function formatRecruitCostSummaryLine(
  troopCfgId: number,
  qty: number,
  cost: TroopRecruitResourceCost,
  timeSec: number,
): string {
  const costText = formatCostParts(cost).join(" · ") || "无资源消耗";
  return `募兵 ${unitLabel(troopCfgId)}×${qty}：${costText} · 耗时 ${formatUpgradeDurationSec(timeSec)}`;
}

/**
 * 纯函数：下一批募兵粮/木/铁/石消耗与训练耗时；不发 RecruitTroop。
 * @param wallet GetCityState.resources / session.wallet
 */
export function previewRecruitCost(
  troopCfgId: number,
  qty: number,
  wallet: ResourceWallet | undefined,
): RecruitCostPreview | null {
  const spec = troopRecruitSpecForCfgId(troopCfgId);
  if (!spec) return null;
  const count = Math.floor(qty);
  if (count <= 0) return null;
  const cost = scaleTroopRecruitCost(spec.recruitCostPerUnit, count);
  const timeSec = spec.secPerUnit * count;
  const insufficientHint = formatUpgradeInsufficientHint(wallet, cost);
  const canAfford = insufficientHint == null;
  return {
    troopCfgId,
    qty: count,
    cost,
    timeSec,
    canAfford,
    insufficientHint,
    summaryLine: formatRecruitCostSummaryLine(troopCfgId, count, cost, timeSec),
  };
}
