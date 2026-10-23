import type { ResourceWallet } from "@/net/bootstrapSession";
import { walletMaterialDeductPulseKeys } from "@/net/recruitSubmitFeedback";

/** 商城购买主按钮默认文案（与 `data-action="buy-offer"` 一致）。 */
export const SHOP_PURCHASE_SUBMIT_DEFAULT_LABEL = "购买×1";
/** PurchaseShopOffer 网关往返期间主按钮文案（CLIENT-113）。 */
export const SHOP_PURCHASE_SUBMIT_INFLIGHT_LABEL = "购买中…";

export type PurchaseSubmitState = "idle" | "submitting" | "error";

export type PurchaseSubmitEvent =
  | { type: "SUBMIT" }
  | { type: "SUCCESS" }
  | { type: "FAIL" }
  | { type: "CLEAR_ERROR" };

/** 商城购买提交纯函数状态机（单测覆盖）。 */
export function purchaseSubmitStateMachine(
  state: PurchaseSubmitState,
  event: PurchaseSubmitEvent,
): PurchaseSubmitState {
  switch (state) {
    case "idle":
      if (event.type === "SUBMIT") return "submitting";
      return "idle";
    case "submitting":
      if (event.type === "SUCCESS") return "idle";
      if (event.type === "FAIL") return "error";
      return "submitting";
    case "error":
      if (event.type === "SUBMIT") return "submitting";
      if (event.type === "CLEAR_ERROR") return "idle";
      return "error";
    default:
      return "idle";
  }
}

export function purchaseSubmitButtonDisabled(
  state: PurchaseSubmitState,
  canPurchase: boolean,
): boolean {
  if (state === "submitting") return true;
  return !canPurchase;
}

export function purchaseSubmitButtonLabel(state: PurchaseSubmitState): string {
  return state === "submitting" ? SHOP_PURCHASE_SUBMIT_INFLIGHT_LABEL : SHOP_PURCHASE_SUBMIT_DEFAULT_LABEL;
}

/** 商城面板购买按钮 disabled / 文案（`data-action="buy-offer"`）。 */
export function syncShopPurchaseSubmitButton(
  formRoot: ParentNode | null | undefined,
  state: PurchaseSubmitState,
  canPurchase: boolean,
): void {
  const btn = formRoot?.querySelector<HTMLButtonElement>('button[data-action="buy-offer"]');
  if (!btn) return;
  btn.disabled = purchaseSubmitButtonDisabled(state, canPurchase);
  btn.textContent = purchaseSubmitButtonLabel(state);
}

/** 购买成功状态栏 / 面板 toast（`offer_cfg_id` 与 proto `offer_id` 对齐）。 */
export function formatShopPurchaseSuccess(offerCfgId: number): string {
  if (offerCfgId <= 0) return "购买成功";
  return `商品 #${offerCfgId} 购买成功`;
}

export function shopPurchasePriceTotal(
  price: ResourceWallet | undefined,
  purchaseCount: number,
): ResourceWallet {
  const out: ResourceWallet = {};
  if (!price || purchaseCount <= 0) return out;
  for (const key of ["food", "wood", "iron", "stone", "gold"] as const) {
    const unit = price[key] ?? 0;
    if (unit > 0) out[key] = unit * purchaseCount;
  }
  return out;
}

/** 扣费涉及四资源且钱包下降时，触发 CLIENT-051 顶栏脉冲（粮木铁石）。 */
export function walletShopPurchaseDeductPulseKeys(
  before: ResourceWallet | undefined,
  after: ResourceWallet | undefined,
  price: ResourceWallet | undefined,
  purchaseCount: number,
): (keyof ResourceWallet)[] {
  return walletMaterialDeductPulseKeys(
    before,
    after,
    shopPurchasePriceTotal(price, purchaseCount),
  );
}
