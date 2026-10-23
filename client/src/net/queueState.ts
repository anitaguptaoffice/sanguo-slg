import type { CityBuilding } from "@/net/bootstrapSession";
import { formatUpgradeRemaining } from "@/net/hudFormat";
import { formatTimeMs, unitLabel } from "@/net/militaryFormat";

export type RecruitQueueEntry = {
  queue_id: number;
  unit_cfg_id: number;
  count: number;
  finish_at_ms: number;
};

export function isQueuedRecruitResponse(res: {
  queue_id?: number;
  finish_at_ms?: number;
}): boolean {
  return (res.queue_id ?? 0) > 0 && (res.finish_at_ms ?? 0) > 0;
}

export function recruitEntryFromResponse(
  res: {
    queue_id?: number;
    finish_at_ms?: number;
  },
  unitCfgId: number,
  count: number,
): RecruitQueueEntry | null {
  if (!isQueuedRecruitResponse(res)) return null;
  return {
    queue_id: res.queue_id ?? 0,
    unit_cfg_id: unitCfgId,
    count,
    finish_at_ms: res.finish_at_ms ?? 0,
  };
}

export function activeBuildingUpgrades(
  buildings: CityBuilding[] | undefined,
  nowMs = Date.now(),
): CityBuilding[] {
  return (buildings ?? [])
    .filter((b) => (b.upgrade_finish_at_ms ?? 0) > nowMs)
    .sort((a, b) => (a.upgrade_finish_at_ms ?? 0) - (b.upgrade_finish_at_ms ?? 0));
}

export function formatBuildingUpgradeQueueLine(
  building: CityBuilding,
  slotLabels: Record<string, string>,
  nowMs = Date.now(),
): string {
  const key = building.slot_key ?? "?";
  const name = slotLabels[key] ?? key;
  const targetLv = (building.level ?? 0) + 1;
  const rem = formatUpgradeRemaining(building.upgrade_finish_at_ms, nowMs);
  const finish = formatTimeMs(building.upgrade_finish_at_ms);
  return `[内政] ${name} → Lv${targetLv} · ${rem ?? "—"} · 完成 ${finish}`;
}

export function formatRecruitQueueLine(entry: RecruitQueueEntry, nowMs = Date.now()): string {
  const rem = formatUpgradeRemaining(entry.finish_at_ms, nowMs);
  const finish = formatTimeMs(entry.finish_at_ms);
  const unit = unitLabel(entry.unit_cfg_id);
  return `[募兵] ${unit}×${entry.count} · #${entry.queue_id} · ${rem ?? "已完成"} · ${finish}`;
}

export function isRecruitQueueActive(entry: RecruitQueueEntry, nowMs = Date.now()): boolean {
  return entry.finish_at_ms > nowMs;
}

export function mergeRecruitQueue(
  current: RecruitQueueEntry[],
  incoming: RecruitQueueEntry,
): RecruitQueueEntry[] {
  const next = current.filter((e) => e.queue_id !== incoming.queue_id);
  next.push(incoming);
  return next.sort((a, b) => a.finish_at_ms - b.finish_at_ms);
}

export function pruneFinishedRecruits(
  entries: RecruitQueueEntry[],
  nowMs = Date.now(),
  keepGraceMs = 60_000,
): RecruitQueueEntry[] {
  return entries.filter((e) => e.finish_at_ms + keepGraceMs > nowMs);
}

export function queuePanelHasCountdown(
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[],
  nowMs = Date.now(),
): boolean {
  if (activeBuildingUpgrades(buildings, nowMs).length > 0) return true;
  return recruits.some((e) => isRecruitQueueActive(e, nowMs));
}
