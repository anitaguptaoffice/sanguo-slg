import { findCitySlotOverlayTag } from "@/net/citySlotQueueLink";

/** CLIENT-372（stub）：队列完成态七槽 wave:58 **巩固再加深五层** 焦点环（3.5s；与 CLIENT-356/363 `domestic-queue-complete-focus-residual-deepest-deepest-deepest-deepest-ring` 软并存）。 */
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS =
  "domestic-queue-complete-focus-residual-deepest-deepest-deepest-deepest-deeper-ring";
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS = 3500;

let residualDeepestDeepestDeepestDeepestDeeperRingTimer: ReturnType<typeof setTimeout> | null =
  null;

export function scheduleDomesticQueueCompleteFocusResidualDeepestDeepestDeepestDeepestDeeperRing(
  overlayLayer: ParentNode | null | undefined,
  slotKey: string,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): boolean {
  const tag = findCitySlotOverlayTag(overlayLayer, slotKey);
  if (!tag) return false;
  tag.classList.remove(
    DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  );
  void tag.offsetWidth;
  tag.classList.add(
    DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  );
  if (residualDeepestDeepestDeepestDeepestDeeperRingTimer != null) {
    clearTimeout(residualDeepestDeepestDeepestDeepestDeeperRingTimer);
  }
  residualDeepestDeepestDeepestDeepestDeeperRingTimer = windowObj.setTimeout(() => {
    tag.classList.remove(
      DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
    );
    residualDeepestDeepestDeepestDeepestDeeperRingTimer = null;
  }, DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_RING_MS);
  return true;
}

/** @internal vitest */
export function resetDomesticQueueCompleteFocusResidualDeepestDeepestDeepestDeepestDeeperRingTimersForTests(): void {
  if (residualDeepestDeepestDeepestDeepestDeeperRingTimer != null) {
    clearTimeout(residualDeepestDeepestDeepestDeepestDeeperRingTimer);
    residualDeepestDeepestDeepestDeepestDeeperRingTimer = null;
  }
}
