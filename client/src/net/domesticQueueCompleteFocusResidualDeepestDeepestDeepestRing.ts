import { findCitySlotOverlayTag } from "@/net/citySlotQueueLink";

/** CLIENT-340：队列完成态七槽残余 **最深再加深四层** 焦点环（3.5s；与 CLIENT-324 3.5s 最深再加深三层环并存）。 */
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS =
  "domestic-queue-complete-focus-residual-deepest-deepest-deepest-ring";
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_MS = 3500;

let residualDeepestDeepestDeepestRingTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleDomesticQueueCompleteFocusResidualDeepestDeepestDeepestRing(
  overlayLayer: ParentNode | null | undefined,
  slotKey: string,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): boolean {
  const tag = findCitySlotOverlayTag(overlayLayer, slotKey);
  if (!tag) return false;
  tag.classList.remove(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS);
  void tag.offsetWidth;
  tag.classList.add(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS);
  if (residualDeepestDeepestDeepestRingTimer != null) {
    clearTimeout(residualDeepestDeepestDeepestRingTimer);
  }
  residualDeepestDeepestDeepestRingTimer = windowObj.setTimeout(() => {
    tag.classList.remove(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS);
    residualDeepestDeepestDeepestRingTimer = null;
  }, DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_MS);
  return true;
}

/** @internal vitest */
export function resetDomesticQueueCompleteFocusResidualDeepestDeepestDeepestRingTimersForTests(): void {
  if (residualDeepestDeepestDeepestRingTimer != null) {
    clearTimeout(residualDeepestDeepestDeepestRingTimer);
    residualDeepestDeepestDeepestRingTimer = null;
  }
}
