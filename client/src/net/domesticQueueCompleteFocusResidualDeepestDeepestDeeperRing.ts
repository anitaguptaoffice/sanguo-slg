import { findCitySlotOverlayTag } from "@/net/citySlotQueueLink";

/** CLIENT-324：队列完成态七槽残余 **最深再加深三层** 焦点环（3.5s；与 CLIENT-308 3.5s 最深再加深二层环并存）。 */
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS =
  "domestic-queue-complete-focus-residual-deepest-deepest-deeper-ring";
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_MS = 3500;

let residualDeepestDeepestDeeperRingTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleDomesticQueueCompleteFocusResidualDeepestDeepestDeeperRing(
  overlayLayer: ParentNode | null | undefined,
  slotKey: string,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): boolean {
  const tag = findCitySlotOverlayTag(overlayLayer, slotKey);
  if (!tag) return false;
  tag.classList.remove(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS);
  void tag.offsetWidth;
  tag.classList.add(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS);
  if (residualDeepestDeepestDeeperRingTimer != null) {
    clearTimeout(residualDeepestDeepestDeeperRingTimer);
  }
  residualDeepestDeepestDeeperRingTimer = windowObj.setTimeout(() => {
    tag.classList.remove(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS);
    residualDeepestDeepestDeeperRingTimer = null;
  }, DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_MS);
  return true;
}

/** @internal vitest */
export function resetDomesticQueueCompleteFocusResidualDeepestDeepestDeeperRingTimersForTests(): void {
  if (residualDeepestDeepestDeeperRingTimer != null) {
    clearTimeout(residualDeepestDeepestDeeperRingTimer);
    residualDeepestDeepestDeeperRingTimer = null;
  }
}
