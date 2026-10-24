import type { CityBuilding } from "@/net/bootstrapSession";
import type { QuestRow } from "@/net/contentFormat";
import {
  findActiveUpgradeForBuildQuest,
  isBuildLevelDailyNeedingProgress,
  isTrainDailyNeedingProgress,
} from "@/net/dailyQuestQueueMatch";
import { dailyQuestNeedsNextStep } from "@/net/dailyQuestObjective";
import { isRecruitQueueActive, type RecruitQueueEntry } from "@/net/queueState";

/** 日常「前往下一步」→ 队列匹配行高亮（CLIENT-186）。 */
export const DAILY_QUEUE_ANCHOR_HIGHLIGHT_CLASS = "daily-queue-anchor-highlight";

export const DAILY_QUEUE_ANCHOR_HIGHLIGHT_MS = 2000;

export type DailyQueueAnchorTarget =
  | { kind: "build"; slotKey: string }
  | { kind: "recruit"; queueId: number };

/**
 * 从进行中日常解析队列锚点行（建造匹配槽位升级 / 练兵匹配进行中募兵），不新 RPC。
 */
export function resolveDailyQueueAnchorTarget(
  quest: QuestRow | null | undefined,
  buildings: CityBuilding[] | undefined,
  recruits: RecruitQueueEntry[] | undefined,
  nowMs = Date.now(),
): DailyQueueAnchorTarget | null {
  if (!quest || !dailyQuestNeedsNextStep(quest)) return null;
  if (isBuildLevelDailyNeedingProgress(quest)) {
    const building = findActiveUpgradeForBuildQuest(quest, buildings, nowMs);
    const slotKey = building?.slot_key?.trim();
    if (slotKey) return { kind: "build", slotKey };
    return null;
  }
  if (isTrainDailyNeedingProgress(quest)) {
    let earliest: RecruitQueueEntry | null = null;
    for (const r of recruits ?? []) {
      if (!isRecruitQueueActive(r, nowMs)) continue;
      if (!earliest || r.finish_at_ms < earliest.finish_at_ms) earliest = r;
    }
    if (earliest && earliest.queue_id > 0) {
      return { kind: "recruit", queueId: earliest.queue_id };
    }
    return null;
  }
  return null;
}

export function scrollDailyQuestCfgRowIntoView(
  panelRoot: ParentNode,
  questCfgId: number,
): void {
  if (questCfgId <= 0) return;
  const row = panelRoot.querySelector(`li[data-quest-cfg-id="${questCfgId}"]`);
  row?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
}
