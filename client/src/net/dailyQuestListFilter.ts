import type { DailyQuestRow } from "@/net/dailyQuestState";
import {
  DAILY_QUEST_STATE_ACCEPTABLE,
  DAILY_QUEST_STATE_CLAIMABLE,
} from "@/net/hudTodoBadge";

/** sessionStorage：日常列表筛选（CLIENT-075，仅客户端，不改 ListPlayerQuests）。 */
export const DAILY_QUEST_FILTER_SESSION_KEY = "daily-quest-filter";

/** 已完成行默认置底（可改为 false 以保留服务端顺序）。 */
export const DAILY_QUEST_PIN_COMPLETED_TO_BOTTOM = true;

export type DailyQuestListFilter = "all" | "in_progress" | "claimable" | "completed";

const FILTER_VALUES: readonly DailyQuestListFilter[] = [
  "all",
  "in_progress",
  "claimable",
  "completed",
];

export const DAILY_QUEST_STATE_IN_PROGRESS = 2;
export const DAILY_QUEST_STATE_COMPLETED = 4;

export type DailyQuestStateCounts = {
  acceptable: number;
  inProgress: number;
  claimable: number;
  completed: number;
};

export function parseDailyQuestListFilterSessionValue(
  raw: string | null | undefined,
): DailyQuestListFilter | null {
  if (raw == null || raw === "") return null;
  if ((FILTER_VALUES as readonly string[]).includes(raw)) {
    return raw as DailyQuestListFilter;
  }
  return null;
}

export function readDailyQuestListFilterSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): DailyQuestListFilter | null {
  try {
    return parseDailyQuestListFilterSessionValue(
      storage?.getItem(DAILY_QUEST_FILTER_SESSION_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

export function writeDailyQuestListFilterSession(
  filter: DailyQuestListFilter,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.setItem(DAILY_QUEST_FILTER_SESSION_KEY, filter);
  } catch {
    /* quota / private mode */
  }
}

export function dailyQuestListFilterLabel(filter: DailyQuestListFilter): string {
  switch (filter) {
    case "all":
      return "全部";
    case "in_progress":
      return "进行中";
    case "claimable":
      return "可领取";
    case "completed":
      return "已完成";
    default:
      return filter;
  }
}

export function dailyQuestMatchesListFilter(
  q: DailyQuestRow,
  filter: DailyQuestListFilter,
): boolean {
  if (filter === "all") return true;
  const s = q.state ?? 0;
  if (filter === "in_progress") return s === DAILY_QUEST_STATE_IN_PROGRESS;
  if (filter === "claimable") return s === DAILY_QUEST_STATE_CLAIMABLE;
  if (filter === "completed") return s === DAILY_QUEST_STATE_COMPLETED;
  return true;
}

export function filterDailyQuestRows(
  rows: DailyQuestRow[],
  filter: DailyQuestListFilter,
): DailyQuestRow[] {
  return rows.filter((q) => dailyQuestMatchesListFilter(q, filter));
}

export function countDailyQuestsByState(rows: DailyQuestRow[]): DailyQuestStateCounts {
  const counts: DailyQuestStateCounts = {
    acceptable: 0,
    inProgress: 0,
    claimable: 0,
    completed: 0,
  };
  for (const q of rows) {
    const s = q.state ?? 0;
    if (s === DAILY_QUEST_STATE_ACCEPTABLE) counts.acceptable++;
    else if (s === DAILY_QUEST_STATE_IN_PROGRESS) counts.inProgress++;
    else if (s === DAILY_QUEST_STATE_CLAIMABLE) counts.claimable++;
    else if (s === DAILY_QUEST_STATE_COMPLETED) counts.completed++;
  }
  return counts;
}

/** 在筛选结果上可选将已完成置底，保留组内相对顺序。 */
export function orderDailyQuestRowsForDisplay(
  rows: DailyQuestRow[],
  pinCompletedToBottom = DAILY_QUEST_PIN_COMPLETED_TO_BOTTOM,
): DailyQuestRow[] {
  if (!pinCompletedToBottom || rows.length < 2) return rows.slice();
  const active: DailyQuestRow[] = [];
  const done: DailyQuestRow[] = [];
  for (const q of rows) {
    if ((q.state ?? 0) === DAILY_QUEST_STATE_COMPLETED) done.push(q);
    else active.push(q);
  }
  return [...active, ...done];
}

export function dailyQuestRowsForList(
  rows: DailyQuestRow[],
  filter: DailyQuestListFilter,
  pinCompletedToBottom = DAILY_QUEST_PIN_COMPLETED_TO_BOTTOM,
): DailyQuestRow[] {
  return orderDailyQuestRowsForDisplay(filterDailyQuestRows(rows, filter), pinCompletedToBottom);
}

export function dailyQuestListEmptyMessage(filter: DailyQuestListFilter): string {
  if (filter === "all") {
    return "（暂无日常任务，请刷新或提升君主等级）";
  }
  return `（当前「${dailyQuestListFilterLabel(filter)}」筛选无匹配日常）`;
}

/** 「可领取」筛选结果中的首条 quest_cfg_id（CLIENT-091 定位首条）。 */
export function pickFirstClaimableDailyQuestCfgIdForFilter(rows: DailyQuestRow[]): number {
  const list = dailyQuestRowsForList(rows, "claimable");
  const id = list[0]?.quest_cfg_id ?? 0;
  return id > 0 ? id : 0;
}
