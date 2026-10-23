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

/** 商城面板 `data-role="shop-form-error"` 内联错误区。 */
export function setShopFormErrorDisplay(
  panelRoot: ParentNode | null | undefined,
  message: string | null,
): void {
  const el = panelRoot?.querySelector('[data-role="shop-form-error"]');
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

/** 背包面板 `data-role="bag-form-error"` 内联错误区。 */
export function setBagFormErrorDisplay(
  panelRoot: ParentNode | null | undefined,
  message: string | null,
): void {
  const el = panelRoot?.querySelector('[data-role="bag-form-error"]');
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}
