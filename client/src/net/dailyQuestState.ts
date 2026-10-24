import type { QuestRow } from "@/net/contentFormat";
import {
  formatDailyQuestDetailWithGuidance,
  formatDailyQuestLineWithObjective,
} from "@/net/dailyQuestObjective";

/** DATA-002 日常链（quest_type=2）。 */
export const DAILY_QUEST_CHAIN_ID = 400;

export const DEFAULT_DAILY_QUEST_CFG_ID = 1012;

/** DATA-002 `daily_recruit_1`（chain 400）。Issue 文案偶有 1013 笔误，真源为 1015。 */
export const DAILY_RECRUIT_QUEST_CFG_ID = 1015;
export const DAILY_RECRUIT_QUEST_CODE = "daily_recruit_1";

export type DailyQuestRow = QuestRow & {
  chain_id?: number;
  /** cfg_quest 主奖励道具（ListPlayerQuests 快照或客户端 DATA-002 回退）。 */
  reward_item_id?: number;
  quantity?: number;
};

export function dailyQuestsFromListResponse(res: { quests?: DailyQuestRow[] }): DailyQuestRow[] {
  return res.quests ?? [];
}

export function formatDailyQuestLine(q: DailyQuestRow): string {
  return formatDailyQuestLineWithObjective(q);
}

export function formatDailyQuestDetail(q: DailyQuestRow | null): string {
  return formatDailyQuestDetailWithGuidance(q);
}

export function pickDefaultDailyQuest(rows: DailyQuestRow[]): DailyQuestRow | null {
  if (!rows.length) return null;
  const preferred = rows.find((r) => r.quest_cfg_id === DEFAULT_DAILY_QUEST_CFG_ID);
  return preferred ?? rows[0];
}

export function findDailyRecruitQuest(rows: DailyQuestRow[]): DailyQuestRow | null {
  return (
    rows.find(
      (r) =>
        r.quest_cfg_id === DAILY_RECRUIT_QUEST_CFG_ID || r.quest_code === DAILY_RECRUIT_QUEST_CODE,
    ) ?? null
  );
}

/** 已接取且服务端仍在累计或已达标待领。 */
export function isDailyRecruitQuestTracked(q: DailyQuestRow | null | undefined): boolean {
  if (!q) return false;
  const s = q.state ?? 0;
  return s === 2 || s === 3;
}

export function formatRecruitDailyFollowUpHint(): string {
  return "日课·访贤进度已更新，请点底栏「日常」查看（chain 400 已刷新）";
}

/** 招募成功闭环：招募前进行中，或招募后变为可领奖时提示刷新日常。 */
export function shouldPromptDailyRecruitAfterRecruit(
  before: DailyQuestRow | null,
  after: DailyQuestRow | null,
): boolean {
  if (before?.state === 2) return true;
  return isDailyRecruitQuestTracked(after);
}
