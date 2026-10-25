/** CLIENT-288：行内态残余 **巩固再加深** 环（2s；与 CLIENT-256/272 环 **并存**）。 */
export const BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPER_RING_CLASS =
  "bag-shop-inline-state-residual-deeper-ring";
export const BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPER_RING_MS = 2000;

let inlineStateResidualDeeperRingTimer: ReturnType<typeof setTimeout> | null = null;

export function clearBagShopInlineStateResidualDeeperRing(
  root: ParentNode | null | undefined,
): void {
  if (!root) return;
  root
    .querySelectorAll<HTMLElement>(`.${BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPER_RING_CLASS}`)
    .forEach((el) => el.classList.remove(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPER_RING_CLASS));
}

/** 行内态元素附加 `bag-shop-inline-state-residual-deeper-ring` 2s（不摘除 CLIENT-272 深环）。 */
export function scheduleBagShopInlineStateResidualDeeperRing(
  target: HTMLElement | null | undefined,
  panelRoot: ParentNode | null | undefined = null,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPER_RING_MS,
): boolean {
  if (!target) return false;
  if (inlineStateResidualDeeperRingTimer != null) {
    windowObj.clearTimeout(inlineStateResidualDeeperRingTimer);
    inlineStateResidualDeeperRingTimer = null;
  }
  clearBagShopInlineStateResidualDeeperRing(panelRoot ?? target.closest(".content-panel"));
  target.classList.remove(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPER_RING_CLASS);
  void target.offsetWidth;
  target.classList.add(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPER_RING_CLASS);
  inlineStateResidualDeeperRingTimer = windowObj.setTimeout(() => {
    target.classList.remove(BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPER_RING_CLASS);
    inlineStateResidualDeeperRingTimer = null;
  }, durationMs);
  return true;
}

/** @internal vitest */
export function resetBagShopInlineStateResidualDeeperRingTimersForTests(): void {
  if (inlineStateResidualDeeperRingTimer != null) {
    clearTimeout(inlineStateResidualDeeperRingTimer);
    inlineStateResidualDeeperRingTimer = null;
  }
}
