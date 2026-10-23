import { formatQuestLine, questStateLabel, type QuestRow } from "@/net/contentFormat";

/** DATA-002 日常链（quest_type=2）。 */
export const DAILY_QUEST_CHAIN_ID = 400;

export const DEFAULT_DAILY_QUEST_CFG_ID = 1012;

export type DailyQuestRow = QuestRow & {
  chain_id?: number;
};

export function dailyQuestsFromListResponse(res: { quests?: DailyQuestRow[] }): DailyQuestRow[] {
  return res.quests ?? [];
}

export function formatDailyQuestLine(q: DailyQuestRow): string {
  return formatQuestLine(q);
}

export function formatDailyQuestDetail(q: DailyQuestRow | null): string {
  if (!q) return "（未选中）";
  const id = q.quest_cfg_id ?? "?";
  const code = q.quest_code ?? "—";
  const prog =
    q.progress_target && q.progress_target > 0
      ? `${q.progress_current ?? 0} / ${q.progress_target}`
      : String(q.progress_current ?? 0);
  return `#${id} · ${code}\n状态：${questStateLabel(q.state)}\n进度：${prog}`;
}

export function pickDefaultDailyQuest(rows: DailyQuestRow[]): DailyQuestRow | null {
  if (!rows.length) return null;
  const preferred = rows.find((r) => r.quest_cfg_id === DEFAULT_DAILY_QUEST_CFG_ID);
  return preferred ?? rows[0];
}
