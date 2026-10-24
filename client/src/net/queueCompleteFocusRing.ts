import { findCitySlotOverlayTag } from "@/net/citySlotQueueLink";
import {
  queueCompleteHudDedupeId,
  type QueueCompleteHudEvent,
} from "@/net/hudQueueCompletePulse";
import { RECRUIT_QUEUE_MATRIX_SLOT_KEY } from "@/net/recruitQueueComplete";

/** 七槽完成焦点环（CLIENT-197，2s）。 */
export const CITY_SLOT_COMPLETE_FOCUS_RING_CLASS = "city-slot-complete-focus-ring";
export const CITY_SLOT_COMPLETE_FOCUS_RING_MS = 2000;

/** 队列行完成互链脉冲（CLIENT-197，2s；与 CLIENT-149 3s 建造/募兵脉冲可叠加）。 */
export const QUEUE_ROW_COMPLETE_PULSE_CLASS = "queue-row-complete-pulse";
export const QUEUE_ROW_COMPLETE_PULSE_MS = 2000;

/** 完成待领取 / 已结束只读队列行。 */
export const QUEUE_ROW_COMPLETE_READONLY_CLASS = "queue-row-complete-readonly";

export const QUEUE_COMPLETE_FOCUS_RING_SESSION_KEY = "queue-complete-focus-ring-v1";

export function citySlotKeyForQueueCompleteEvent(event: QueueCompleteHudEvent): string {
  if (event.kind === "build") return event.slotKey.trim();
  return RECRUIT_QUEUE_MATRIX_SLOT_KEY;
}

export function readQueueCompleteFocusRingDedupeIds(
  storage: Pick<Storage, "getItem">,
): Set<string> {
  try {
    const raw = storage.getItem(QUEUE_COMPLETE_FOCUS_RING_SESSION_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string" && x.length > 0));
  } catch {
    return new Set();
  }
}

export function writeQueueCompleteFocusRingDedupeIds(
  storage: Pick<Storage, "setItem">,
  ids: Set<string>,
): void {
  storage.setItem(QUEUE_COMPLETE_FOCUS_RING_SESSION_KEY, JSON.stringify([...ids].sort()));
}

/** 同一完成事件仅触发一次七槽焦点环（与 HUD `queue-complete-pulse-v1` 独立去重）。 */
export function shouldRingCitySlotOnQueueComplete(
  dedupeId: string,
  storage: Pick<Storage, "getItem" | "setItem">,
): boolean {
  if (!dedupeId) return false;
  const seen = readQueueCompleteFocusRingDedupeIds(storage);
  if (seen.has(dedupeId)) return false;
  seen.add(dedupeId);
  writeQueueCompleteFocusRingDedupeIds(storage, seen);
  return true;
}

export function collectCitySlotKeysForQueueCompleteFocus(
  events: readonly QueueCompleteHudEvent[],
  storage: Pick<Storage, "getItem" | "setItem">,
): string[] {
  const keys: string[] = [];
  for (const event of events) {
    const dedupeId = queueCompleteHudDedupeId(event);
    if (!shouldRingCitySlotOnQueueComplete(dedupeId, storage)) continue;
    const slotKey = citySlotKeyForQueueCompleteEvent(event);
    if (slotKey) keys.push(slotKey);
  }
  return keys;
}

let citySlotFocusRingTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleCitySlotCompleteFocusRing(
  overlayLayer: ParentNode | null | undefined,
  slotKey: string,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): boolean {
  const tag = findCitySlotOverlayTag(overlayLayer, slotKey);
  if (!tag) return false;
  tag.classList.remove(CITY_SLOT_COMPLETE_FOCUS_RING_CLASS);
  void tag.offsetWidth;
  tag.classList.add(CITY_SLOT_COMPLETE_FOCUS_RING_CLASS);
  if (citySlotFocusRingTimer != null) {
    clearTimeout(citySlotFocusRingTimer);
  }
  citySlotFocusRingTimer = windowObj.setTimeout(() => {
    tag.classList.remove(CITY_SLOT_COMPLETE_FOCUS_RING_CLASS);
    citySlotFocusRingTimer = null;
  }, CITY_SLOT_COMPLETE_FOCUS_RING_MS);
  return true;
}

export function scheduleQueueRowCompletePulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  row.classList.remove(QUEUE_ROW_COMPLETE_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(QUEUE_ROW_COMPLETE_PULSE_CLASS);
  window.setTimeout(
    () => row.classList.remove(QUEUE_ROW_COMPLETE_PULSE_CLASS),
    QUEUE_ROW_COMPLETE_PULSE_MS,
  );
}

/** @internal vitest */
export function resetQueueCompleteFocusRingTimersForTests(): void {
  if (citySlotFocusRingTimer != null) {
    clearTimeout(citySlotFocusRingTimer);
    citySlotFocusRingTimer = null;
  }
}
