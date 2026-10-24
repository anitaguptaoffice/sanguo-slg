import { questStateLabel } from "@/net/contentFormat";
import { dailyObjectiveLabelForQuest } from "@/net/dailyQuestObjective";
import {
  DAILY_QUEST_STATE_COMPLETED,
  DAILY_QUEST_STATE_IN_PROGRESS,
} from "@/net/dailyQuestListFilter";
import { DAILY_QUEST_STATE_CLAIMABLE } from "@/net/hudTodoBadge";
import type { DailyQuestRow } from "@/net/dailyQuestState";

/** 日常列表主行：标签 + cfg + 状态（进度放次行扫读）。 */
export function formatDailyQuestRowPrimary(q: DailyQuestRow): string {
  const tag = dailyObjectiveLabelForQuest(q);
  const id = q.quest_cfg_id ?? "?";
  const code = q.quest_code ?? "";
  return `[${tag}] #${id} ${code} · ${questStateLabel(q.state)}`;
}

/** chain 400 次行进度文案（ListPlayerQuests 快照，不新 RPC）。 */
export function formatDailyQuestProgressSecondary(q: DailyQuestRow): string | null {
  const state = q.state ?? 0;
  const target = q.progress_target ?? 0;
  if (state === DAILY_QUEST_STATE_COMPLETED) {
    if (target > 0) {
      return `链进度 ${target}/${target} · 已完成`;
    }
    return "已完成";
  }
  if (target <= 0) return null;
  const current = q.progress_current ?? 0;
  const base = `链进度 ${current}/${target}`;
  if (state === DAILY_QUEST_STATE_CLAIMABLE) {
    return `${base} · 可领取`;
  }
  if (state === DAILY_QUEST_STATE_IN_PROGRESS) {
    return base;
  }
  return base;
}
