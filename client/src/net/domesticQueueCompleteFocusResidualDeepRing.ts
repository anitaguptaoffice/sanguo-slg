import { findCitySlotOverlayTag } from "@/net/citySlotQueueLink";

/** CLIENT-260：队列完成态七槽残余深焦点环（2.5s；与 CLIENT-244 2s 环并存）。 */
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS =
  "domestic-queue-complete-focus-residual-deep-ring";
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_MS = 2500;

let residualDeepRingTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleDomesticQueueCompleteFocusResidualDeepRing(
  overlayLayer: ParentNode | null | undefined,
  slotKey: string,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): boolean {
  const tag = findCitySlotOverlayTag(overlayLayer, slotKey);
  if (!tag) return false;
  tag.classList.remove(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS);
  void tag.offsetWidth;
  tag.classList.add(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS);
  if (residualDeepRingTimer != null) {
    clearTimeout(residualDeepRingTimer);
  }
  residualDeepRingTimer = windowObj.setTimeout(() => {
    tag.classList.remove(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS);
    residualDeepRingTimer = null;
  }, DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_MS);
  return true;
}

/** @internal vitest */
export function resetDomesticQueueCompleteFocusResidualDeepRingTimersForTests(): void {
  if (residualDeepRingTimer != null) {
    clearTimeout(residualDeepRingTimer);
    residualDeepRingTimer = null;
  }
}
