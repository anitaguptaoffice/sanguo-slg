import type { CityBuilding } from "@/net/bootstrapSession";
import type { QuestRow } from "@/net/contentFormat";
import {
  BUILDING_CFG_TO_SLOT_KEY,
  findBuildDailyQuestForBuilding,
  findTrainDailyQuestForRecruit,
  pickNearestActiveQueueEntry,
  resolveBuildingCfgId,
  type NearestQueueSnapshot,
} from "@/net/dailyQuestQueueMatch";
import { formatUpgradeRemaining } from "@/net/hudFormat";
import { formatTimeMs, unitLabel } from "@/net/militaryFormat";
import type { RecruitQueueEntry } from "@/net/queueState";

/** CLIENT-218：队列顶栏下一完成 ETA 只读预览行。 */
export const QUEUE_NEXT_FINISH_PREVIEW_CLASS = "queue-next-finish-preview";
export const QUEUE_NEXT_FINISH_PREVIEW_ACTION = "queue-open-daily-anchor";

/**
 * CLIENT-212 软依赖：ETA 分段只读标签（未合入主树时本卡自带 stub，合入后可改为 re-export）。
 */
export function formatDomesticQueueEtaSegmentLabel(
  finishAtMs: number,
  nowMs = Date.now(),
): string | null {
  const finish = finishAtMs ?? 0;
  if (finish <= nowMs) return null;
  const remainingSec = Math.ceil((finish - nowMs) / 1000);
  if (remainingSec < 3600) return "<1h";
  const endOfToday = new Date(nowMs);
  endOfToday.setHours(23, 59, 59, 999);
  if (finish <= endOfToday.getTime()) return "今日内";
  if (remainingSec > 86_400) return ">1d";
  return null;
}

export type NextQueueFinishPreview = {
  line: string;
  questCfgId: number;
  finishAtMs: number;
};

export function resolveNextQueueFinishDailyQuestCfgId(
  snapshot: NearestQueueSnapshot,
  dailyRows: QuestRow[],
  nowMs = Date.now(),
): number {
  if (snapshot.kind === "build") {
    const q = findBuildDailyQuestForBuilding(snapshot.building, dailyRows, nowMs);
    return q?.quest_cfg_id ?? 0;
  }
  const q = findTrainDailyQuestForRecruit(snapshot.recruit, dailyRows, nowMs);
  return q?.quest_cfg_id ?? 0;
}

function formatNearestQueueFinishLabel(
  snapshot: NearestQueueSnapshot,
  slotLabels: Record<string, string>,
  nowMs: number,
): string {
  if (snapshot.kind === "build") {
    const building = snapshot.building;
    const key =
      building.slot_key ?? BUILDING_CFG_TO_SLOT_KEY[resolveBuildingCfgId(building)] ?? "?";
    const name = slotLabels[key] ?? key;
    const targetLv = (building.level ?? 0) + 1;
    const rem = formatUpgradeRemaining(building.upgrade_finish_at_ms, nowMs);
    const finish = formatTimeMs(building.upgrade_finish_at_ms);
    const parts = [`[内政] ${name} → Lv${targetLv}`];
    if (rem) parts.push(rem);
    parts.push(finish);
    return parts.join(" · ");
  }
  const r = snapshot.recruit;
  const rem = formatUpgradeRemaining(r.finish_at_ms, nowMs);
  const finish = formatTimeMs(r.finish_at_ms);
  const unit = unitLabel(r.unit_cfg_id);
  const parts = [`[募兵] ${unit}×${r.count}`];
  if (rem) parts.push(rem ?? "—");
  parts.push(finish);
  return parts.join(" · ");
}

/**
 * 建造/募兵队列中下一完成项 ETA 只读预览（与 `pickNearestActiveQueueEntry` 同源）。
 */
export function formatNextQueueFinishPreviewLine(
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  slotLabels: Record<string, string>,
  dailyRows: QuestRow[],
  nowMs = Date.now(),
): NextQueueFinishPreview | null {
  const nearest = pickNearestActiveQueueEntry(buildings, recruits, nowMs);
  if (!nearest) return null;
  const label = formatNearestQueueFinishLabel(nearest, slotLabels, nowMs);
  const segment = formatDomesticQueueEtaSegmentLabel(nearest.finishAtMs, nowMs);
  const line = segment ? `下一完成 ${label} · ${segment}` : `下一完成 ${label}`;
  const questCfgId = resolveNextQueueFinishDailyQuestCfgId(nearest, dailyRows, nowMs);
  return { line, questCfgId, finishAtMs: nearest.finishAtMs };
}
