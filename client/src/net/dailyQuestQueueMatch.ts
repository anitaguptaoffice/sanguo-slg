import type { CityBuilding } from "@/net/bootstrapSession";
import type { QuestRow } from "@/net/contentFormat";
import { formatUpgradeRemaining } from "@/net/hudFormat";
import {
  dailyObjectiveKindForQuest,
  dailyQuestNeedsNextStep,
} from "@/net/dailyQuestObjective";
import {
  activeBuildingUpgrades,
  isRecruitQueueActive,
  type RecruitQueueEntry,
} from "@/net/queueState";
import { unitLabel } from "@/net/militaryFormat";

/** DATA-002 `cfg_building.building_cfg_id` → 主城 `slot_key`。 */
export const BUILDING_CFG_TO_SLOT_KEY: Record<number, string> = {
  1: "hall",
  2: "farm",
  3: "lumber",
  4: "quarry",
  5: "iron",
  6: "barracks",
  7: "wall",
};

const SLOT_KEY_TO_BUILDING_CFG: Record<string, number> = Object.fromEntries(
  Object.entries(BUILDING_CFG_TO_SLOT_KEY).map(([id, slot]) => [slot, Number(id)]),
);

/** 主城 `slot_key` → DATA-002 `building_cfg_id`（与 BUILDING_CFG_TO_SLOT_KEY 互逆）。 */
export function buildingCfgIdForSlot(slotKey: string): number {
  return SLOT_KEY_TO_BUILDING_CFG[slotKey.trim()] ?? 0;
}

export type BuildLevelQuestTarget = {
  buildingCfgId: number;
  level: number;
};

/** chain 400 建造日常 objective（与 DATA-002 / cfg_quest 一致，无服务端 objective 字段时客户端真源）。 */
const BUILD_QUEST_TARGET_BY_CFG_ID: Record<number, BuildLevelQuestTarget> = {
  1032: { buildingCfgId: 2, level: 2 },
};

const BUILD_QUEST_TARGET_BY_CODE: Record<string, BuildLevelQuestTarget> = {
  daily_build_1: { buildingCfgId: 2, level: 2 },
};

export function resolveBuildingCfgId(building: CityBuilding): number {
  const explicit = building.building_cfg_id ?? 0;
  if (explicit > 0) return explicit;
  const slot = building.slot_key?.trim() ?? "";
  return SLOT_KEY_TO_BUILDING_CFG[slot] ?? 0;
}

export function resolveBuildLevelQuestTarget(q: QuestRow): BuildLevelQuestTarget | null {
  if (dailyObjectiveKindForQuest(q) !== "build_level") return null;
  const id = q.quest_cfg_id ?? 0;
  if (id && BUILD_QUEST_TARGET_BY_CFG_ID[id]) return BUILD_QUEST_TARGET_BY_CFG_ID[id];
  const code = q.quest_code?.trim();
  if (code && BUILD_QUEST_TARGET_BY_CODE[code]) return BUILD_QUEST_TARGET_BY_CODE[code];
  return null;
}

export function isBuildLevelDailyNeedingProgress(q: QuestRow | null | undefined): boolean {
  if (!q || !dailyQuestNeedsNextStep(q)) return false;
  return dailyObjectiveKindForQuest(q) === "build_level";
}

export function isTrainDailyNeedingProgress(q: QuestRow | null | undefined): boolean {
  if (!q || !dailyQuestNeedsNextStep(q)) return false;
  return dailyObjectiveKindForQuest(q) === "train_troops";
}

/** 队列建造行：匹配日常只读进度（chain 400 快照，不新 RPC）。 */
export function formatLinkedDailyQuestProgressSummary(q: QuestRow): string | null {
  const target = q.progress_target ?? 0;
  if (target <= 0) return null;
  return `日课 ${q.progress_current ?? 0}/${target}`;
}

export type NearestQueueSnapshot =
  | { kind: "build"; finishAtMs: number; building: CityBuilding }
  | { kind: "recruit"; finishAtMs: number; recruit: RecruitQueueEntry };

/** 建造+募兵进行中项里最早到期的一条（与 QueuePanels 顶栏口径一致）。 */
export function pickNearestActiveQueueEntry(
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  nowMs = Date.now(),
): NearestQueueSnapshot | null {
  let best: NearestQueueSnapshot | null = null;
  for (const b of activeBuildingUpgrades(buildings, nowMs)) {
    const t = b.upgrade_finish_at_ms ?? 0;
    if (t <= nowMs) continue;
    if (!best || t < best.finishAtMs) best = { kind: "build", finishAtMs: t, building: b };
  }
  for (const r of recruits ?? []) {
    if (!isRecruitQueueActive(r, nowMs)) continue;
    if (!best || r.finish_at_ms < best.finishAtMs) {
      best = { kind: "recruit", finishAtMs: r.finish_at_ms, recruit: r };
    }
  }
  return best;
}

export function formatNearestQueueCountdownHint(
  snapshot: NearestQueueSnapshot,
  slotLabels: Record<string, string>,
  nowMs = Date.now(),
): string {
  if (snapshot.kind === "build") {
    const building = snapshot.building;
    const key = building.slot_key ?? BUILDING_CFG_TO_SLOT_KEY[resolveBuildingCfgId(building)] ?? "?";
    const name = slotLabels[key] ?? key;
    const targetLv = (building.level ?? 0) + 1;
    const rem = formatUpgradeRemaining(building.upgrade_finish_at_ms, nowMs);
    return `队列：${name} → Lv${targetLv} · 剩余 ${rem ?? "—"}`;
  }
  const r = snapshot.recruit;
  const rem = formatUpgradeRemaining(r.finish_at_ms, nowMs);
  const unit = unitLabel(r.unit_cfg_id);
  return `队列：${unit}×${r.count} · 剩余 ${rem ?? "—"}`;
}

export function isBuildingUpgradeActive(building: CityBuilding, nowMs = Date.now()): boolean {
  return (building.upgrade_finish_at_ms ?? 0) > nowMs;
}

/** 队列行升级是否服务于该建造日常目标（槽位 + 目标等级）。 */
export function buildingUpgradeMatchesBuildQuest(
  building: CityBuilding,
  quest: QuestRow,
  nowMs = Date.now(),
): boolean {
  const target = resolveBuildLevelQuestTarget(quest);
  if (!target || !isBuildingUpgradeActive(building, nowMs)) return false;
  if (resolveBuildingCfgId(building) !== target.buildingCfgId) return false;
  const upgradingTo = (building.level ?? 0) + 1;
  return upgradingTo === target.level;
}

export function findBuildDailyQuestForBuilding(
  building: CityBuilding,
  quests: QuestRow[],
  nowMs = Date.now(),
): QuestRow | null {
  for (const q of quests) {
    if (!isBuildLevelDailyNeedingProgress(q)) continue;
    if (buildingUpgradeMatchesBuildQuest(building, q, nowMs)) return q;
  }
  return null;
}

/** 募兵队列行：匹配进行中练兵日常（chain 400 快照，不新 RPC）。 */
export function findTrainDailyQuestForRecruit(
  recruit: RecruitQueueEntry,
  quests: QuestRow[],
  nowMs = Date.now(),
): QuestRow | null {
  if (!isRecruitQueueActive(recruit, nowMs)) return null;
  for (const q of quests) {
    if (isTrainDailyNeedingProgress(q)) return q;
  }
  return null;
}

export function findActiveUpgradeForBuildQuest(
  quest: QuestRow,
  buildings: CityBuilding[] | undefined,
  nowMs = Date.now(),
): CityBuilding | null {
  if (!isBuildLevelDailyNeedingProgress(quest)) return null;
  const target = resolveBuildLevelQuestTarget(quest);
  if (!target) return null;
  for (const b of buildings ?? []) {
    if (buildingUpgradeMatchesBuildQuest(b, quest, nowMs)) return b;
  }
  return null;
}

/** 日常行只读队列快照摘要（不发起 RPC）。 */
export function formatBuildQueueCountdownForQuest(
  quest: QuestRow,
  buildings: CityBuilding[] | undefined,
  slotLabels: Record<string, string>,
  nowMs = Date.now(),
): string | null {
  const building = findActiveUpgradeForBuildQuest(quest, buildings, nowMs);
  if (!building) return null;
  return formatNearestQueueCountdownHint(
    { kind: "build", finishAtMs: building.upgrade_finish_at_ms ?? 0, building },
    slotLabels,
    nowMs,
  );
}

/** 建造/练兵日常行：匹配升级或最近到期募兵/建造倒计时（与 QueuePanels 同源快照）。 */
export function formatDailyQuestQueueInlineHint(
  quest: QuestRow,
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  slotLabels: Record<string, string>,
  nowMs = Date.now(),
): string | null {
  if (isBuildLevelDailyNeedingProgress(quest)) {
    const matched = formatBuildQueueCountdownForQuest(quest, buildings, slotLabels, nowMs);
    if (matched) return matched;
  }
  if (!isBuildLevelDailyNeedingProgress(quest) && !isTrainDailyNeedingProgress(quest)) {
    return null;
  }
  const nearest = pickNearestActiveQueueEntry(buildings, recruits, nowMs);
  if (!nearest) return null;
  return formatNearestQueueCountdownHint(nearest, slotLabels, nowMs);
}
