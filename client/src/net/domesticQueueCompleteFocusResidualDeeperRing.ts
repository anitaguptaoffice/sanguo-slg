import { findCitySlotOverlayTag } from "@/net/citySlotQueueLink";

/** CLIENT-276：队列完成态七槽残余 **更深** 焦点环（3s；与 CLIENT-260 2.5s 深环并存）。 */
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_CLASS =
  "domestic-queue-complete-focus-residual-deeper-ring";
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_MS = 3000;

let residualDeeperRingTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleDomesticQueueCompleteFocusResidualDeeperRing(
  overlayLayer: ParentNode | null | undefined,
  slotKey: string,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): boolean {
  const tag = findCitySlotOverlayTag(overlayLayer, slotKey);
  if (!tag) return false;
  tag.classList.remove(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_CLASS);
  void tag.offsetWidth;
  tag.classList.add(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_CLASS);
  if (residualDeeperRingTimer != null) {
    clearTimeout(residualDeeperRingTimer);
  }
  residualDeeperRingTimer = windowObj.setTimeout(() => {
    tag.classList.remove(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_CLASS);
    residualDeeperRingTimer = null;
  }, DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_MS);
  return true;
}

/** @internal vitest */
export function resetDomesticQueueCompleteFocusResidualDeeperRingTimersForTests(): void {
  if (residualDeeperRingTimer != null) {
    clearTimeout(residualDeeperRingTimer);
    residualDeeperRingTimer = null;
  }
}
