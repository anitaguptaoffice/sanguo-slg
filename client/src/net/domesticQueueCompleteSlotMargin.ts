import type { CityBuilding } from "@/net/bootstrapSession";
import { isSlotUpgradeInProgress } from "@/net/buildQueueComplete";
import { findCitySlotOverlayTag } from "@/net/citySlotQueueLink";

/** CLIENT-212：队列完成态七槽余量扫读（2s 脉冲；CLIENT-197 焦点环并存）。 */
export const DOMESTIC_QUEUE_COMPLETE_SLOT_MARGIN_CLASS = "domestic-queue-complete-slot-margin";
export const DOMESTIC_QUEUE_COMPLETE_SLOT_MARGIN_MS = 2000;

/** 完成瞬间槽位只读余量文案（空闲 / 仍升级中）。 */
export function formatDomesticQueueCompleteSlotMarginLabel(
  building: CityBuilding | undefined,
  nowMs = Date.now(),
): string {
  if (isSlotUpgradeInProgress(building, nowMs)) return "升级中槽";
  return "空闲槽";
}

let marginPulseTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleDomesticQueueCompleteSlotMargin(
  overlayLayer: ParentNode | null | undefined,
  slotKey: string,
  label: string,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): boolean {
  const tag = findCitySlotOverlayTag(overlayLayer, slotKey);
  if (!tag || !label.trim()) return false;

  tag.querySelectorAll(`.${DOMESTIC_QUEUE_COMPLETE_SLOT_MARGIN_CLASS}`).forEach((el) => el.remove());

  const margin = document.createElement("span");
  margin.className = DOMESTIC_QUEUE_COMPLETE_SLOT_MARGIN_CLASS;
  margin.textContent = label.trim();
  tag.appendChild(margin);
  void margin.offsetWidth;

  if (marginPulseTimer != null) {
    clearTimeout(marginPulseTimer);
  }
  marginPulseTimer = windowObj.setTimeout(() => {
    margin.remove();
    marginPulseTimer = null;
  }, DOMESTIC_QUEUE_COMPLETE_SLOT_MARGIN_MS);
  return true;
}

/** @internal vitest */
export function resetDomesticQueueCompleteSlotMarginTimersForTests(): void {
  if (marginPulseTimer != null) {
    clearTimeout(marginPulseTimer);
    marginPulseTimer = null;
  }
}
