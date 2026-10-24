import type { CityBuilding } from "@/net/bootstrapSession";
import { sortBuildQueueRows } from "@/net/buildQueueMatrix";
import { formatUpgradeRemaining } from "@/net/hudFormat";
import { formatTimeMs, unitLabel } from "@/net/militaryFormat";

export { sortBuildQueueRows } from "@/net/buildQueueMatrix";

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
  return sortBuildQueueRows(buildings ?? [], nowMs);
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

/** 建造+募兵队列中最早完成时刻（毫秒）；无进行中项时 null。 */
export function nearestQueueFinishAtMs(
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[],
  nowMs = Date.now(),
): number | null {
  let best: number | null = null;
  for (const b of activeBuildingUpgrades(buildings, nowMs)) {
    const t = b.upgrade_finish_at_ms ?? 0;
    if (t > nowMs && (best === null || t < best)) best = t;
  }
  for (const r of recruits) {
    if (!isRecruitQueueActive(r, nowMs)) continue;
    if (best === null || r.finish_at_ms < best) best = r.finish_at_ms;
  }
  return best;
}

/** 最近一条队列完成倒计时摘要（纯展示，不含槽位名）。 */
export function formatBuildQueueCountdown(
  finishAtMs: number | null | undefined,
  nowMs = Date.now(),
): string | null {
  if (!finishAtMs || finishAtMs <= nowMs) return null;
  const rem = formatUpgradeRemaining(finishAtMs, nowMs);
  return rem ? `最近 ${rem}` : null;
}

/** 队列面板顶栏：进行中建造/募兵条数 + 最近倒计时。 */
export function formatQueuePanelOverviewBar(
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[],
  nowMs = Date.now(),
): string {
  const buildCount = activeBuildingUpgrades(buildings, nowMs).length;
  const recruitCount = recruits.filter((e) => isRecruitQueueActive(e, nowMs)).length;
  const parts = [`建造 ${buildCount}`, `募兵 ${recruitCount}`];
  const countdown = formatBuildQueueCountdown(
    nearestQueueFinishAtMs(buildings, recruits, nowMs),
    nowMs,
  );
  if (countdown) parts.push(countdown);
  return parts.join(" · ");
}
