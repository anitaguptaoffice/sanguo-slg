import { findCitySlotOverlayTag } from "@/net/citySlotQueueLink";

/** CLIENT-372：队列完成态七槽残余 **最深再加深五层** 焦点环（3.5s；与 CLIENT-356 3.5s 最深再加深五层环并存）。 */
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_RING_CLASS =
  "domestic-queue-complete-focus-residual-deepest-deepest-deepest-deepest-ring";
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_RING_MS = 3500;

let residualDeepestDeepestDeepestDeepestRingTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleDomesticQueueCompleteFocusResidualDeepestDeepestDeepestDeepestRing(
  overlayLayer: ParentNode | null | undefined,
  slotKey: string,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): boolean {
  const tag = findCitySlotOverlayTag(overlayLayer, slotKey);
  if (!tag) return false;
  tag.classList.remove(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_RING_CLASS);
  void tag.offsetWidth;
  tag.classList.add(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_RING_CLASS);
  if (residualDeepestDeepestDeepestDeepestRingTimer != null) {
    clearTimeout(residualDeepestDeepestDeepestDeepestRingTimer);
  }
  residualDeepestDeepestDeepestDeepestRingTimer = windowObj.setTimeout(() => {
    tag.classList.remove(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_RING_CLASS);
    residualDeepestDeepestDeepestDeepestRingTimer = null;
  }, DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_RING_MS);
  return true;
}

/** @internal vitest */
export function resetDomesticQueueCompleteFocusResidualDeepestDeepestDeepestDeepestRingTimersForTests(): void {
  if (residualDeepestDeepestDeepestDeepestRingTimer != null) {
    clearTimeout(residualDeepestDeepestDeepestDeepestRingTimer);
    residualDeepestDeepestDeepestDeepestRingTimer = null;
  }
}
