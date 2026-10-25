/** CLIENT-320：行内态残余 **巩固再加深二层** 环（2s；与 CLIENT-304 最深环 **并存**）。 */
export const BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPER_RING_CLASS =
  "bag-shop-inline-state-residual-deepest-deeper-ring";
export const BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPER_RING_MS = 2000;

let inlineStateResidualDeepestDeeperRingTimer: ReturnType<typeof setTimeout> | null = null;

export function clearBagShopInlineStateResidualDeepestDeeperRing(
  root: ParentNode | null | undefined,
): void {
  if (!root) return;
  root
    .querySelectorAll<HTMLElement>(`.${BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPER_RING_CLASS}`)
    .forEach((el) => el.classList.remove(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPER_RING_CLASS));
}

/** 行内态元素附加 `bag-shop-inline-state-residual-deepest-deeper-ring` 2s（不摘除 CLIENT-304 最深环）。 */
export function scheduleBagShopInlineStateResidualDeepestDeeperRing(
  target: HTMLElement | null | undefined,
  panelRoot: ParentNode | null | undefined = null,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPER_RING_MS,
): boolean {
  if (!target) return false;
  if (inlineStateResidualDeepestDeeperRingTimer != null) {
    windowObj.clearTimeout(inlineStateResidualDeepestDeeperRingTimer);
    inlineStateResidualDeepestDeeperRingTimer = null;
  }
  clearBagShopInlineStateResidualDeepestDeeperRing(panelRoot ?? target.closest(".content-panel"));
  target.classList.remove(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPER_RING_CLASS);
  void target.offsetWidth;
  target.classList.add(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPER_RING_CLASS);
  inlineStateResidualDeepestDeeperRingTimer = windowObj.setTimeout(() => {
    target.classList.remove(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPER_RING_CLASS);
    inlineStateResidualDeepestDeeperRingTimer = null;
  }, durationMs);
  return true;
}

/** @internal vitest */
export function resetBagShopInlineStateResidualDeepestDeeperRingTimersForTests(): void {
  if (inlineStateResidualDeepestDeeperRingTimer != null) {
    clearTimeout(inlineStateResidualDeepestDeeperRingTimer);
    inlineStateResidualDeepestDeeperRingTimer = null;
  }
}
