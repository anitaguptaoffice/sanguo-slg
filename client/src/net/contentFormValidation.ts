import type { ResourceWallet } from "@/net/bootstrapSession";
import type { BagStack } from "@/net/bagState";
import type { ShopOfferRow } from "@/net/contentFeedback";
import { itemLabel } from "@/net/contentFormat";
import { WALLET_RESOURCE_KEYS } from "@/net/hudFormat";

export type PurchaseShopOfferValidationInput = {
  offer: ShopOfferRow | undefined;
  offerId: number;
  purchaseCount: number;
  wallet: ResourceWallet | undefined;
};

export type UseConsumableValidationInput = {
  itemCfgId: number;
  count: number;
  bag: BagStack[];
};

export type ContentFormValidationOk = { ok: true };

export type ContentFormValidationFail = { ok: false; message: string };

export type ContentFormValidationResult = ContentFormValidationOk | ContentFormValidationFail;

function affordResourceErrors(
  wallet: ResourceWallet | undefined,
  price: ResourceWallet,
  purchaseCount: number,
): string[] {
  const errors: string[] = [];
  for (const { key, label } of WALLET_RESOURCE_KEYS) {
    const unit = price[key] ?? 0;
    if (unit <= 0) continue;
    const need = unit * purchaseCount;
    const have = wallet?.[key] ?? 0;
    if (have < need) {
      if (key === "gold") {
        errors.push(`金币不足（需要 ${need}，当前 ${have}）`);
      } else {
        errors.push(`${label}不足（需要 ${need}，当前 ${have}）`);
      }
    }
  }
  return errors;
}

/** 商城购买前客户端校验（不发 PurchaseShopOffer RPC）。 */
export function validatePurchaseShopOffer(
  input: PurchaseShopOfferValidationInput,
): ContentFormValidationResult {
  const errors: string[] = [];
  const offer = input.offer;
  const count = input.purchaseCount;

  if (!offer || (offer.offer_id != null && offer.offer_id !== input.offerId)) {
    errors.push(`未找到商品 offer #${input.offerId}`);
  } else {
    if (offer.sold_out) {
      errors.push("该商品已售罄");
    }
    const limit = offer.purchase_limit;
    if (limit != null && limit > 0) {
      const purchased = offer.purchased_count ?? 0;
      if (purchased + count > limit) {
        errors.push(`已超过限购次数（已购 ${purchased}/${limit}）`);
      }
    }
    errors.push(...affordResourceErrors(input.wallet, offer.price_resources ?? {}, count));
  }

  if (errors.length) {
    return { ok: false, message: errors.join("；") };
  }
  return { ok: true };
}

/** 背包使用前客户端校验（不发 UseConsumable RPC）。 */
export function validateUseConsumable(input: UseConsumableValidationInput): ContentFormValidationResult {
  const errors: string[] = [];
  const { itemCfgId, count, bag } = input;

  if (!Number.isFinite(count) || !Number.isInteger(count) || count <= 0) {
    errors.push("使用数量须大于 0");
  }

  const stack = bag.find((row) => row.item_cfg_id === itemCfgId);
  const qty = stack?.quantity ?? 0;
  if (!stack || qty <= 0) {
    errors.push(`背包中没有 ${itemLabel(itemCfgId)}`);
  }

  if (errors.length) {
    return { ok: false, message: errors.join("；") };
  }
  return { ok: true };
}

/** 招募/商城/背包/军事四类面板内联错误区（CLIENT-067）。 */
export type PanelFormDomain = "recruit" | "shop" | "bag" | "march";

/** 列表首屏拉取域（CLIENT-173）；与 PanelFormDomain 共用 `formatPanelGatewayError` code 映射。 */
export type PanelListGatewayDomain = "rank" | "guild" | "buildQueue";

export type PanelGatewayDomain = PanelFormDomain | PanelListGatewayDomain;

const PANEL_FORM_ERROR_ROLE: Record<PanelFormDomain, string> = {
  recruit: "recruit-form-error",
  shop: "shop-form-error",
  bag: "bag-form-error",
  march: "march-form-error",
};

const COMMON_INVALID_PACKET = 10001;
const DOMESTIC_INSUFFICIENT_RESOURCE = 40001;

const PANEL_GATEWAY_CODE_HINT: Record<PanelGatewayDomain, Partial<Record<number, string>>> = {
  shop: {
    64001: "货架不存在或未开放",
    64002: "商品不存在或已下架",
    64003: "余额不足",
    64004: "已售罄",
    64005: "超过限购次数",
    64006: "购买数量无效",
  },
  bag: {
    [COMMON_INVALID_PACKET]: "请求无效",
    [DOMESTIC_INSUFFICIENT_RESOURCE]: "资源不足",
  },
  recruit: {
    [COMMON_INVALID_PACKET]: "道具不足",
    [DOMESTIC_INSUFFICIENT_RESOURCE]: "资源不足",
  },
  march: {
    30001: "城池不存在",
    50001: "兵种配置无效",
    50002: "兵力数量无效",
    50005: "出征参数无效",
    50006: "城内兵力不足",
  },
  rank: {
    62001: "排行榜不存在",
    62002: "排行榜未开放",
    [COMMON_INVALID_PACKET]: "请求无效",
  },
  guild: {
    60001: "军团不存在",
    60002: "已在其他军团",
    60003: "不在该军团",
    60006: "军团人数已满",
    60007: "军团权限不足",
    [COMMON_INVALID_PACKET]: "请求无效",
  },
  buildQueue: {
    [COMMON_INVALID_PACKET]: "请求无效",
    [DOMESTIC_INSUFFICIENT_RESOURCE]: "资源不足",
    40002: "城池不存在",
    40003: "建筑槽位无效",
    40004: "建筑等级已满",
  },
};

/**
 * 四类面板网关失败文案：优先域内 code 中文摘要，末尾固定 `[code]`（与预校验区同元素展示）。
 */
export function formatPanelGatewayError(
  domain: PanelGatewayDomain,
  code: number | undefined,
  msg: string,
): string {
  const trimmed = msg?.trim() ?? "";
  if (code === undefined) {
    return trimmed || "未知错误";
  }
  const hinted = PANEL_GATEWAY_CODE_HINT[domain]?.[code];
  const summary = hinted ?? (trimmed || "操作失败");
  if (hinted && trimmed && trimmed !== hinted) {
    return `${summary}：${trimmed} [${code}]`;
  }
  return `${summary} [${code}]`;
}

export function formatPanelGatewayErrorFromUnknown(domain: PanelGatewayDomain, err: unknown): string {
  if (err instanceof Error) {
    const code = (err as Error & { code?: number }).code;
    return formatPanelGatewayError(domain, code, err.message);
  }
  return String(err);
}

/** 统一内联错误区渲染（`march-form-error` / `shop-form-error` / `bag-form-error` / `recruit-form-error`）。 */
export function setPanelFormErrorDisplay(
  panelRoot: ParentNode | null | undefined,
  domain: PanelFormDomain,
  message: string | null,
): void {
  const el = panelRoot?.querySelector(`[data-role="${PANEL_FORM_ERROR_ROLE[domain]}"]`);
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

/** 商城面板 `data-role="shop-form-error"` 内联错误区。 */
export function setShopFormErrorDisplay(
  panelRoot: ParentNode | null | undefined,
  message: string | null,
): void {
  setPanelFormErrorDisplay(panelRoot, "shop", message);
}

/** 背包面板 `data-role="bag-form-error"` 内联错误区。 */
export function setBagFormErrorDisplay(
  panelRoot: ParentNode | null | undefined,
  message: string | null,
): void {
  setPanelFormErrorDisplay(panelRoot, "bag", message);
}
