import {
  BAG_SHOP_INLINE_STATE_RESIDUAL_RING_MS,
  scheduleBagShopInlineStateResidualRing,
} from "@/net/bagShopInlineStateResidual";
import { scheduleBagShopInlineStateResidualDeeperRing } from "@/net/bagShopInlineStateResidualDeeperRing";
import { scheduleBagShopInlineStateResidualDeepestRing } from "@/net/bagShopInlineStateResidualDeepestRing";
import { scheduleBagShopInlineStateResidualDeepestDeeperRing } from "@/net/bagShopInlineStateResidualDeepestDeeperRing";
import { scheduleBagShopInlineStateResidualDeepestDeepestDeeperRing } from "@/net/bagShopInlineStateResidualDeepestDeepestDeeperRing";
import { scheduleBagShopInlineStateResidualDeepestDeepestDeepestRing } from "@/net/bagShopInlineStateResidualDeepestDeepestDeepestRing";
import { scheduleBagShopInlineStateResidualDeepestDeepestDeepestDeeperRing } from "@/net/bagShopInlineStateResidualDeepestDeepestDeepestDeeperRing";

/** CLIENT-272：行内态残余 **加深** 环（2s；与 CLIENT-256 1.5s 环 **并存**）。 */
export const BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_CLASS =
  "bag-shop-inline-state-residual-deep-ring";
export const BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_MS = 2000;

let inlineStateResidualDeepRingTimer: ReturnType<typeof setTimeout> | null = null;

export function clearBagShopInlineStateResidualDeepRing(
  root: ParentNode | null | undefined,
): void {
  if (!root) return;
  root
    .querySelectorAll<HTMLElement>(`.${BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_CLASS}`)
    .forEach((el) => el.classList.remove(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_CLASS));
}

/** 行内态元素附加 `bag-shop-inline-state-residual-deep-ring` 2s（不摘除 CLIENT-256 环）。 */
export function scheduleBagShopInlineStateResidualDeepRing(
  target: HTMLElement | null | undefined,
  panelRoot: ParentNode | null | undefined = null,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_MS,
): boolean {
  if (!target) return false;
  if (inlineStateResidualDeepRingTimer != null) {
    windowObj.clearTimeout(inlineStateResidualDeepRingTimer);
    inlineStateResidualDeepRingTimer = null;
  }
  clearBagShopInlineStateResidualDeepRing(panelRoot ?? target.closest(".content-panel"));
  target.classList.remove(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_CLASS);
  void target.offsetWidth;
  target.classList.add(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_CLASS);
  inlineStateResidualDeepRingTimer = windowObj.setTimeout(() => {
    target.classList.remove(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_CLASS);
    inlineStateResidualDeepRingTimer = null;
  }, durationMs);
  return true;
}

/** CLIENT-256 残余环 + CLIENT-272 加深环 + CLIENT-288 再深环 + CLIENT-304 巩固再加深一层环 + CLIENT-320 巩固再加深二层环 + CLIENT-336 巩固再加深三层环 + CLIENT-352 巩固再加深四层环 + CLIENT-368 巩固再加深五层环（CLIENT-194/092 行内文案不退化）。 */
export function pulseBagShopInlineStateResidualRings(
  target: HTMLElement | null | undefined,
  panelRoot: ParentNode | null | undefined = null,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
): boolean {
  const scheduled = scheduleBagShopInlineStateResidualRing(
    target,
    panelRoot,
    windowObj,
    BAG_SHOP_INLINE_STATE_RESIDUAL_RING_MS,
  );
  scheduleBagShopInlineStateResidualDeepRing(target, panelRoot, windowObj);
  scheduleBagShopInlineStateResidualDeeperRing(target, panelRoot, windowObj);
  scheduleBagShopInlineStateResidualDeepestRing(target, panelRoot, windowObj);
  scheduleBagShopInlineStateResidualDeepestDeeperRing(target, panelRoot, windowObj);
  scheduleBagShopInlineStateResidualDeepestDeepestDeeperRing(target, panelRoot, windowObj);
  scheduleBagShopInlineStateResidualDeepestDeepestDeepestRing(target, panelRoot, windowObj);
  scheduleBagShopInlineStateResidualDeepestDeepestDeepestDeeperRing(target, panelRoot, windowObj);
  return scheduled;
}

/** @internal vitest */
export function resetBagShopInlineStateResidualDeepRingTimersForTests(): void {
  if (inlineStateResidualDeepRingTimer != null) {
    clearTimeout(inlineStateResidualDeepRingTimer);
    inlineStateResidualDeepRingTimer = null;
  }
}
