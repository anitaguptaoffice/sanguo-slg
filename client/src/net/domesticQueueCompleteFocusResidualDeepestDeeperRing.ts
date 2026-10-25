import { findCitySlotOverlayTag } from "@/net/citySlotQueueLink";

/** CLIENT-308：队列完成态七槽残余 **最深再加深二层** 焦点环（3.5s；与 CLIENT-292 3s 最深环并存）。 */
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPER_RING_CLASS =
  "domestic-queue-complete-focus-residual-deepest-deeper-ring";
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPER_RING_MS = 3500;

let residualDeepestDeeperRingTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleDomesticQueueCompleteFocusResidualDeepestDeeperRing(
  overlayLayer: ParentNode | null | undefined,
  slotKey: string,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): boolean {
  const tag = findCitySlotOverlayTag(overlayLayer, slotKey);
  if (!tag) return false;
  tag.classList.remove(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPER_RING_CLASS);
  void tag.offsetWidth;
  tag.classList.add(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPER_RING_CLASS);
  if (residualDeepestDeeperRingTimer != null) {
    clearTimeout(residualDeepestDeeperRingTimer);
  }
  residualDeepestDeeperRingTimer = windowObj.setTimeout(() => {
    tag.classList.remove(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPER_RING_CLASS);
    residualDeepestDeeperRingTimer = null;
  }, DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPER_RING_MS);
  return true;
}

/** @internal vitest */
export function resetDomesticQueueCompleteFocusResidualDeepestDeeperRingTimersForTests(): void {
  if (residualDeepestDeeperRingTimer != null) {
    clearTimeout(residualDeepestDeeperRingTimer);
    residualDeepestDeeperRingTimer = null;
  }
}
