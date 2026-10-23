import type { ResourceWallet } from "@/net/bootstrapSession";
import { itemLabel } from "@/net/contentFormat";
import { formatResourceHudGroup, formatWalletGainBrief } from "@/net/hudFormat";

export type UseConsumableResult = {
  effect_summary?: string;
  speedup_seconds?: number;
  wallet_after?: ResourceWallet;
};

export type ShopOfferRow = {
  offer_id?: number;
  shelf_name?: string;
  item_cfg_id?: number;
  quantity_per_purchase?: number;
  price_resources?: ResourceWallet;
  purchase_limit?: number;
  purchased_count?: number;
  sold_out?: boolean;
};

/** 网关错误稳定展示：`[code] msg`（与 GatewayClient.rpc 抛出的 Error.code 对齐）。 */
export function gatewayErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const code = (err as Error & { code?: number }).code;
    const msg = err.message || "未知错误";
    return code !== undefined ? `[${code}] ${msg}` : msg;
  }
  return String(err);
}

function formatSpeedupSeconds(seconds: number): string {
  if (seconds <= 0) return "";
  if (seconds % 3600 === 0) return `加速 ${seconds / 3600} 小时`;
  if (seconds % 60 === 0) return `加速 ${seconds / 60} 分钟`;
  return `加速 ${seconds} 秒`;
}

/**
 * 背包使用成功后的可读效果摘要（面板 + 状态栏）。
 * 优先服务端 `effect_summary`；否则按道具类型与 speedup 字段推导；资源包可叠加钱包增量。
 */
export function formatUseConsumableEffectSummary(
  itemCfgId: number,
  res: UseConsumableResult,
  walletBefore?: ResourceWallet,
  walletAfter?: ResourceWallet,
): string {
  const parts: string[] = [];
  const name = itemLabel(itemCfgId);
  if (res.effect_summary?.trim()) {
    parts.push(res.effect_summary.trim());
  } else if (itemCfgId === 2003 && (res.speedup_seconds ?? 0) > 0) {
    parts.push(formatSpeedupSeconds(res.speedup_seconds ?? 0));
  } else if (itemCfgId === 2001) {
    parts.push("已使用资源包");
  }

  const after = walletAfter ?? res.wallet_after;
  const gain = formatWalletGainBrief(walletBefore, after);
  if (gain) parts.push(gain);

  if (!parts.length) parts.push(`${name} 已使用`);
  return `${name}：${parts.join(" · ")}`;
}

/** 商城货架行文案（限购/售罄与 CLIENT-010 一致）。 */
export function formatShopOfferListLine(o: ShopOfferRow, priceText: string): string {
  const limitHint =
    o.purchase_limit != null
      ? ` · 限购 ${o.purchased_count ?? 0}/${o.purchase_limit}`
      : o.purchased_count != null && o.purchased_count > 0
        ? ` · 已购 ${o.purchased_count}`
        : "";
  const sold = o.sold_out ? " · 售罄" : "";
  return (
    `#${o.offer_id} ${o.shelf_name ?? ""} → ${itemLabel(o.item_cfg_id)}×${o.quantity_per_purchase ?? 1} · ${priceText}` +
    sold +
    limitHint
  );
}

/** 购买成功：行内「已购 +N」与 wallet_after（与顶栏 HUD 同格式）对照。 */
export function formatShopPurchaseFeedback(
  purchaseCount: number,
  walletAfter: ResourceWallet | undefined,
  opts?: { itemCfgId?: number; grantedQty?: number },
): string {
  const bought = `已购 +${purchaseCount}`;
  const hud = walletAfter ? formatResourceHudGroup(walletAfter) : "";
  const grant =
    opts?.itemCfgId != null && opts.grantedQty != null
      ? `获得 ${itemLabel(opts.itemCfgId)}×${opts.grantedQty}`
      : "";
  return [bought, grant, hud ? `钱包 ${hud}` : ""].filter(Boolean).join(" · ");
}
