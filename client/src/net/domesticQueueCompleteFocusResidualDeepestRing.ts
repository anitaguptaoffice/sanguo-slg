import { findCitySlotOverlayTag } from "@/net/citySlotQueueLink";

/** CLIENT-292：队列完成态七槽残余 **最深** 焦点环（3s；与 CLIENT-276 3s 更深环并存）。 */
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_CLASS =
  "domestic-queue-complete-focus-residual-deepest-ring";
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_MS = 3000;

let residualDeepestRingTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleDomesticQueueCompleteFocusResidualDeepestRing(
  overlayLayer: ParentNode | null | undefined,
  slotKey: string,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): boolean {
  const tag = findCitySlotOverlayTag(overlayLayer, slotKey);
  if (!tag) return false;
  tag.classList.remove(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_CLASS);
  void tag.offsetWidth;
  tag.classList.add(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_CLASS);
  if (residualDeepestRingTimer != null) {
    clearTimeout(residualDeepestRingTimer);
  }
  residualDeepestRingTimer = windowObj.setTimeout(() => {
    tag.classList.remove(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_CLASS);
    residualDeepestRingTimer = null;
  }, DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_MS);
  return true;
}

/** @internal vitest */
export function resetDomesticQueueCompleteFocusResidualDeepestRingTimersForTests(): void {
  if (residualDeepestRingTimer != null) {
    clearTimeout(residualDeepestRingTimer);
    residualDeepestRingTimer = null;
  }
}
