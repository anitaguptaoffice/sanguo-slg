import { findCitySlotOverlayTag } from "@/net/citySlotQueueLink";

/** CLIENT-244：队列完成态七槽残余焦点环（2s；与 CLIENT-197/212 并存）。 */
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_CLASS =
  "domestic-queue-complete-focus-residual-ring";
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_MS = 2000;

let residualRingTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleDomesticQueueCompleteFocusResidualRing(
  overlayLayer: ParentNode | null | undefined,
  slotKey: string,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): boolean {
  const tag = findCitySlotOverlayTag(overlayLayer, slotKey);
  if (!tag) return false;
  tag.classList.remove(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_CLASS);
  void tag.offsetWidth;
  tag.classList.add(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_CLASS);
  if (residualRingTimer != null) {
    clearTimeout(residualRingTimer);
  }
  residualRingTimer = windowObj.setTimeout(() => {
    tag.classList.remove(DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_CLASS);
    residualRingTimer = null;
  }, DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_MS);
  return true;
}

/** @internal vitest */
export function resetDomesticQueueCompleteFocusResidualRingTimersForTests(): void {
  if (residualRingTimer != null) {
    clearTimeout(residualRingTimer);
    residualRingTimer = null;
  }
}
