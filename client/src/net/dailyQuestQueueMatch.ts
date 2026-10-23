import type { CityBuilding } from "@/net/bootstrapSession";
import type { QuestRow } from "@/net/contentFormat";
import { formatUpgradeRemaining } from "@/net/hudFormat";
import {
  dailyObjectiveKindForQuest,
  dailyQuestNeedsNextStep,
} from "@/net/dailyQuestObjective";

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
  const key = building.slot_key ?? BUILDING_CFG_TO_SLOT_KEY[resolveBuildingCfgId(building)] ?? "?";
  const name = slotLabels[key] ?? key;
  const targetLv = (building.level ?? 0) + 1;
  const rem = formatUpgradeRemaining(building.upgrade_finish_at_ms, nowMs);
  return `队列：${name} → Lv${targetLv} · 剩余 ${rem ?? "—"}`;
}
