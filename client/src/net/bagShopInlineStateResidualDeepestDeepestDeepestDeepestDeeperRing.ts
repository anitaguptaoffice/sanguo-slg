/** CLIENT-384：行内态残余 **巩固再加深五层** 环（2s；与 CLIENT-368 五层环 **并存**）。窄屏 manifest 导出软依赖 **CLIENT-387**。 */
export const BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS =
  "bag-shop-inline-state-residual-deepest-deepest-deepest-deepest-deeper-ring";
export const BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS = 2000;

let inlineStateResidualDeepestDeepestDeepestDeepestDeeperRingTimer: ReturnType<
  typeof setTimeout
> | null = null;

export function clearBagShopInlineStateResidualDeepestDeepestDeepestDeepestDeeperRing(
  root: ParentNode | null | undefined,
): void {
  if (!root) return;
  root
    .querySelectorAll<HTMLElement>(
      `.${BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS}`,
    )
    .forEach((el) =>
      el.classList.remove(
        BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
      ),
    );
}

/** 行内态元素附加 `bag-shop-inline-state-residual-deepest-deepest-deepest-deepest-deeper-ring` 2s（不摘除 CLIENT-368 五层环）。 */
export function scheduleBagShopInlineStateResidualDeepestDeepestDeepestDeepestDeeperRing(
  target: HTMLElement | null | undefined,
  panelRoot: ParentNode | null | undefined = null,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS,
): boolean {
  if (!target) return false;
  if (inlineStateResidualDeepestDeepestDeepestDeepestDeeperRingTimer != null) {
    windowObj.clearTimeout(inlineStateResidualDeepestDeepestDeepestDeepestDeeperRingTimer);
    inlineStateResidualDeepestDeepestDeepestDeepestDeeperRingTimer = null;
  }
  clearBagShopInlineStateResidualDeepestDeepestDeepestDeepestDeeperRing(
    panelRoot ?? target.closest(".content-panel"),
  );
  target.classList.remove(
    BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  );
  void target.offsetWidth;
  target.classList.add(
    BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  );
  inlineStateResidualDeepestDeepestDeepestDeepestDeeperRingTimer = windowObj.setTimeout(() => {
    target.classList.remove(
      BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
    );
    inlineStateResidualDeepestDeepestDeepestDeepestDeeperRingTimer = null;
  }, durationMs);
  return true;
}

/** @internal vitest */
export function resetBagShopInlineStateResidualDeepestDeepestDeepestDeepestDeeperRingTimersForTests(): void {
  if (inlineStateResidualDeepestDeepestDeepestDeepestDeeperRingTimer != null) {
    clearTimeout(inlineStateResidualDeepestDeepestDeepestDeepestDeeperRingTimer);
    inlineStateResidualDeepestDeepestDeepestDeepestDeeperRingTimer = null;
  }
}
