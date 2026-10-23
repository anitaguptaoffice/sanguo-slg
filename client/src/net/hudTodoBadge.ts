import type { DailyQuestRow } from "@/net/dailyQuestState";

/** 日常 chain 400：可接取 */
export const DAILY_QUEST_STATE_ACCEPTABLE = 1;
/** 日常 chain 400：可领奖 */
export const DAILY_QUEST_STATE_CLAIMABLE = 3;

export type HudTodoBadgeCounts = {
  mailUnread: number;
  dailyTodo: number;
  battleReportUnread: number;
};

export function countDailyTodoQuests(rows: DailyQuestRow[]): number {
  let n = 0;
  for (const q of rows) {
    const s = q.state ?? 0;
    if (s === DAILY_QUEST_STATE_ACCEPTABLE || s === DAILY_QUEST_STATE_CLAIMABLE) n++;
  }
  return n;
}

/** 角标展示：0 隐藏；>99 显示 99+ */
export function formatHudBadgeCount(count: number): string {
  if (count <= 0) return "";
  if (count > 99) return "99+";
  return String(count);
}

export function aggregateHudTodoCounts(parts: {
  mailUnread?: number;
  dailyTodo?: number;
  battleReportUnread?: number;
}): HudTodoBadgeCounts {
  return {
    mailUnread: Math.max(0, parts.mailUnread ?? 0),
    dailyTodo: Math.max(0, parts.dailyTodo ?? 0),
    battleReportUnread: Math.max(0, parts.battleReportUnread ?? 0),
  };
}
