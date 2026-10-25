/** CLIENT-304：行内态残余 **巩固再加深一层** 环（2s；与 CLIENT-256/272/288 环 **并存**）。 */
export const BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_RING_CLASS =
  "bag-shop-inline-state-residual-deepest-ring";
export const BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_RING_MS = 2000;

let inlineStateResidualDeepestRingTimer: ReturnType<typeof setTimeout> | null = null;

export function clearBagShopInlineStateResidualDeepestRing(
  root: ParentNode | null | undefined,
): void {
  if (!root) return;
  root
    .querySelectorAll<HTMLElement>(`.${BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_RING_CLASS}`)
    .forEach((el) => el.classList.remove(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_RING_CLASS));
}

/** 行内态元素附加 `bag-shop-inline-state-residual-deepest-ring` 2s（不摘除 CLIENT-288 再深环）。 */
export function scheduleBagShopInlineStateResidualDeepestRing(
  target: HTMLElement | null | undefined,
  panelRoot: ParentNode | null | undefined = null,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_RING_MS,
): boolean {
  if (!target) return false;
  if (inlineStateResidualDeepestRingTimer != null) {
    windowObj.clearTimeout(inlineStateResidualDeepestRingTimer);
    inlineStateResidualDeepestRingTimer = null;
  }
  clearBagShopInlineStateResidualDeepestRing(panelRoot ?? target.closest(".content-panel"));
  target.classList.remove(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_RING_CLASS);
  void target.offsetWidth;
  target.classList.add(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_RING_CLASS);
  inlineStateResidualDeepestRingTimer = windowObj.setTimeout(() => {
    target.classList.remove(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_RING_CLASS);
    inlineStateResidualDeepestRingTimer = null;
  }, durationMs);
  return true;
}

/** @internal vitest */
export function resetBagShopInlineStateResidualDeepestRingTimersForTests(): void {
  if (inlineStateResidualDeepestRingTimer != null) {
    clearTimeout(inlineStateResidualDeepestRingTimer);
    inlineStateResidualDeepestRingTimer = null;
  }
}
