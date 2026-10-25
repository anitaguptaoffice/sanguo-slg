/** CLIENT-352：行内态残余 **巩固再加深四层** 环（2s；与 CLIENT-336 三层环 **并存**）。窄屏 manifest 导出软依赖 **CLIENT-355**。 */
export const BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS =
  "bag-shop-inline-state-residual-deepest-deepest-deepest-ring";
export const BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_MS = 2000;

let inlineStateResidualDeepestDeepestDeepestRingTimer: ReturnType<typeof setTimeout> | null =
  null;

export function clearBagShopInlineStateResidualDeepestDeepestDeepestRing(
  root: ParentNode | null | undefined,
): void {
  if (!root) return;
  root
    .querySelectorAll<HTMLElement>(
      `.${BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS}`,
    )
    .forEach((el) =>
      el.classList.remove(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS),
    );
}

/** 行内态元素附加 `bag-shop-inline-state-residual-deepest-deepest-deepest-ring` 2s（不摘除 CLIENT-336 三层环）。 */
export function scheduleBagShopInlineStateResidualDeepestDeepestDeepestRing(
  target: HTMLElement | null | undefined,
  panelRoot: ParentNode | null | undefined = null,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_MS,
): boolean {
  if (!target) return false;
  if (inlineStateResidualDeepestDeepestDeepestRingTimer != null) {
    windowObj.clearTimeout(inlineStateResidualDeepestDeepestDeepestRingTimer);
    inlineStateResidualDeepestDeepestDeepestRingTimer = null;
  }
  clearBagShopInlineStateResidualDeepestDeepestDeepestRing(panelRoot ?? target.closest(".content-panel"));
  target.classList.remove(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS);
  void target.offsetWidth;
  target.classList.add(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS);
  inlineStateResidualDeepestDeepestDeepestRingTimer = windowObj.setTimeout(() => {
    target.classList.remove(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS);
    inlineStateResidualDeepestDeepestDeepestRingTimer = null;
  }, durationMs);
  return true;
}

/** @internal vitest */
export function resetBagShopInlineStateResidualDeepestDeepestDeepestRingTimersForTests(): void {
  if (inlineStateResidualDeepestDeepestDeepestRingTimer != null) {
    clearTimeout(inlineStateResidualDeepestDeepestDeepestRingTimer);
    inlineStateResidualDeepestDeepestDeepestRingTimer = null;
  }
}
