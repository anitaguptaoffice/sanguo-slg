import type { CityBuilding } from "@/net/bootstrapSession";

export const QUEUE_BUILD_COMPLETE_PULSE_CLASS = "queue-build-complete-pulse";
/** 建造完成行脉冲（与 index.html 动画一致）。 */
export const QUEUE_BUILD_COMPLETE_PULSE_MS = 3000;

/** 队列行与画布升级标签互高亮（CLIENT-066 + CLIENT-105）。 */
export const QUEUE_BUILD_SLOT_MUTUAL_HIGHLIGHT_CLASS = "queue-build-slot-mutual-highlight";

export function isSlotUpgradeInProgress(
  building: CityBuilding | undefined,
  nowMs = Date.now(),
): boolean {
  return (building?.upgrade_finish_at_ms ?? 0) > nowMs;
}

function buildingsBySlot(buildings: CityBuilding[] | undefined): Map<string, CityBuilding> {
  const map = new Map<string, CityBuilding>();
  for (const b of buildings ?? []) {
    const key = b.slot_key?.trim();
    if (key) map.set(key, b);
  }
  return map;
}

/**
 * GetCityState 前后对比：某槽位 `upgrade_finish_at_ms` 由进行中变为空闲。
 */
export function detectBuildJustCompleted(
  prev: CityBuilding[] | undefined,
  next: CityBuilding[] | undefined,
  nowMs = Date.now(),
): string[] {
  const prevMap = buildingsBySlot(prev);
  const nextMap = buildingsBySlot(next);
  const keys = new Set([...prevMap.keys(), ...nextMap.keys()]);
  const completed: string[] = [];
  for (const key of keys) {
    const wasActive = isSlotUpgradeInProgress(prevMap.get(key), nowMs);
    const stillActive = isSlotUpgradeInProgress(nextMap.get(key), nowMs);
    if (wasActive && !stillActive) completed.push(key);
  }
  return completed.sort();
}

export function scheduleQueueBuildCompletePulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  row.classList.remove(QUEUE_BUILD_COMPLETE_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(QUEUE_BUILD_COMPLETE_PULSE_CLASS);
  window.setTimeout(
    () => row.classList.remove(QUEUE_BUILD_COMPLETE_PULSE_CLASS),
    QUEUE_BUILD_COMPLETE_PULSE_MS,
  );
}
