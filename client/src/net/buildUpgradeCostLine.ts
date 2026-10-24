import type { ResourceWallet } from "@/net/bootstrapSession";
import type { BuildingUpgradeResourceCost } from "@/net/buildingUpgradeCatalog";
import { formatResourceAmount, WALLET_RESOURCE_KEYS } from "@/net/hudFormat";
import { formatUpgradeDurationSec } from "@/net/previewUpgradeCost";

const BUILD_RESOURCE_KEYS = WALLET_RESOURCE_KEYS.filter(({ key }) => key !== "gold");

export type BuildUpgradeCostLineResult = {
  /** 纯文本行（含升至 Lv 前缀与可选耗时）。 */
  textLine: string;
  /** 带 `resource-deficit` 缺口着色的 HTML 片段。 */
  htmlLine: string;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function costSegmentMarkup(
  label: string,
  amount: number,
  deficient: boolean,
): string {
  const text = `${escapeHtml(label)} ${formatResourceAmount(amount)}`;
  if (!deficient) return `<span class="build-cost-segment">${text}</span>`;
  return `<span class="build-cost-segment resource-deficit">${text}</span>`;
}

/**
 * 下级建造/升级粮木铁石行内预览；相对 wallet 不足段加 `resource-deficit`（CLIENT-164 / CLIENT-082 扩展）。
 */
export function formatBuildUpgradeCostLine(
  targetLevel: number,
  cost: BuildingUpgradeResourceCost,
  wallet: ResourceWallet | undefined,
  options?: { timeSec?: number },
): BuildUpgradeCostLineResult {
  const parts: string[] = [];
  const htmlParts: string[] = [];
  for (const { key, label } of BUILD_RESOURCE_KEYS) {
    const need = cost[key as keyof BuildingUpgradeResourceCost] ?? 0;
    if (need <= 0) continue;
    const have = wallet?.[key] ?? 0;
    const deficient = have < need;
    parts.push(`${label} ${formatResourceAmount(need)}`);
    htmlParts.push(costSegmentMarkup(label, need, deficient));
  }
  const costText = parts.join(" · ") || "无资源消耗";
  const costHtml =
    htmlParts.join('<span class="build-cost-sep"> · </span>') || "无资源消耗";
  const timeSec = options?.timeSec;
  const durationSuffix =
    timeSec != null && timeSec > 0 ? ` · 耗时 ${formatUpgradeDurationSec(timeSec)}` : "";
  const prefix = `升至 Lv${targetLevel}：`;
  return {
    textLine: `${prefix}${costText}${durationSuffix}`,
    htmlLine: `${prefix}${costHtml}${durationSuffix}`,
  };
}
