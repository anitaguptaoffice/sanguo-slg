import type { ResourceWallet } from "@/net/bootstrapSession";
import { formatResourceAmount, WALLET_RESOURCE_KEYS } from "@/net/hudFormat";

/** 缺口对比条仅对比粮/木/铁/石（与 GetCityState.resources 对齐，不含币）。 */
export const WALLET_GAP_RESOURCE_KEYS = WALLET_RESOURCE_KEYS.filter(({ key }) => key !== "gold");

export type WalletGapSegment = {
  key: keyof ResourceWallet;
  label: string;
  need: number;
  have: number;
  insufficient: boolean;
};

export type WalletGapLineOptions = {
  /** 将 required 各字段乘以该倍数（商城购买数量）。 */
  multiplier?: number;
  /** 背包选中消耗品：展示四资源余量对比（需为 0）。 */
  includeZeroNeed?: boolean;
};

/** UseConsumable 不扣粮木铁石（DATA-002 消耗品）；背包缺口条仅只读余量对比。 */
export function consumableUseWalletNeed(_itemCfgId: number, _count: number): ResourceWallet {
  return {};
}

export function buildWalletGapSegments(
  required: ResourceWallet | undefined,
  wallet: ResourceWallet | undefined,
  options?: WalletGapLineOptions,
): WalletGapSegment[] {
  const multiplier = options?.multiplier ?? 1;
  const includeZeroNeed = options?.includeZeroNeed ?? false;
  const segments: WalletGapSegment[] = [];
  for (const { key, label } of WALLET_GAP_RESOURCE_KEYS) {
    const unit = required?.[key] ?? 0;
    const need = Math.max(0, Math.floor(unit * multiplier));
    if (need <= 0 && !includeZeroNeed) continue;
    const have = wallet?.[key] ?? 0;
    segments.push({
      key,
      label,
      need,
      have,
      insufficient: need > 0 && have < need,
    });
  }
  return segments;
}

/** 纯文本缺口对比行，如「粮 需50/余100 · 木 需10/余5」；无段时 null。 */
export function formatWalletGapLine(
  required: ResourceWallet | undefined,
  wallet: ResourceWallet | undefined,
  options?: WalletGapLineOptions,
): string | null {
  const segments = buildWalletGapSegments(required, wallet, options);
  if (!segments.length) return null;
  return segments
    .map((s) => {
      const needTxt = formatResourceAmount(s.need);
      const haveTxt = formatResourceAmount(s.have);
      return `${s.label} 需${needTxt}/余${haveTxt}`;
    })
    .join(" · ");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function segmentMarkup(segment: WalletGapSegment): string {
  const labelClass = segment.insufficient ? "resource-gap-warn" : "resource-gap-label";
  const needTxt = formatResourceAmount(segment.need);
  const haveTxt = formatResourceAmount(segment.have);
  return `<span class="wallet-gap-segment"><span class="${labelClass}">${escapeHtml(segment.label)}</span> 需${needTxt}/余${haveTxt}</span>`;
}

/** 带 `resource-gap-warn` 高亮不足资源名的 HTML 片段（供商城/背包面板只读展示）。 */
export function renderWalletGapMarkup(
  required: ResourceWallet | undefined,
  wallet: ResourceWallet | undefined,
  options?: WalletGapLineOptions,
): string | null {
  const segments = buildWalletGapSegments(required, wallet, options);
  if (!segments.length) return null;
  return segments.map(segmentMarkup).join('<span class="wallet-gap-sep"> · </span>');
}

export function applyWalletGapBar(
  panelRoot: ParentNode | null | undefined,
  role: "shop-wallet-gap" | "bag-wallet-gap",
  required: ResourceWallet | undefined,
  wallet: ResourceWallet | undefined,
  options?: WalletGapLineOptions,
): void {
  const el = panelRoot?.querySelector(`[data-role="${role}"]`);
  if (!el || !(el instanceof HTMLElement)) return;
  const markup = renderWalletGapMarkup(required, wallet, options);
  if (!markup) {
    el.innerHTML = "";
    el.classList.add("hidden");
    return;
  }
  el.innerHTML = markup;
  el.classList.remove("hidden");
}
