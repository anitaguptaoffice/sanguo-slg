import type { DailyQuestRow } from "@/net/dailyQuestState";
import type { MailRow } from "@/net/heroMailState";
import { mailIsUnread } from "@/net/heroMailState";

/** 日常 chain 400：可接取 */
export const DAILY_QUEST_STATE_ACCEPTABLE = 1;
/** 日常 chain 400：可领奖 */
export const DAILY_QUEST_STATE_CLAIMABLE = 3;

export type HudTodoBadgeCounts = {
  /** CLIENT-107：底栏邮件角标（未读∪未领附件去重） */
  mailUnread: number;
  /** CLIENT-107：底栏日常角标（可领取 state=3） */
  dailyTodo: number;
  /** CLIENT-107：底栏队列角标（建造进行中槽位） */
  queueBuilding: number;
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
  queueBuilding?: number;
  battleReportUnread?: number;
}): HudTodoBadgeCounts {
  return {
    mailUnread: Math.max(0, parts.mailUnread ?? 0),
    dailyTodo: Math.max(0, parts.dailyTodo ?? 0),
    queueBuilding: Math.max(0, parts.queueBuilding ?? 0),
    battleReportUnread: Math.max(0, parts.battleReportUnread ?? 0),
  };
}

export type HudTodoDeepLinkSnapshot = HudTodoBadgeCounts & {
  /** ListPlayerMail unread 筛选 total_count（原始未读条数）。 */
  mailUnreadTotal: number;
  /** ListPlayerMail filter=all 首屏，供 CLIENT-107 邮件角标与 CLIENT-077 可领推导。 */
  mailClaimablePage: MailRow[];
  firstUnreadMailId: number;
  firstDailyTodoCfgId: number;
  firstUnreadBattleReportId: number;
  /** 最近一次 chain 400 轮询列表，供队列↔日常互链只读（不再单独 RPC）。 */
  dailyChainRows: DailyQuestRow[];
  /** CLIENT-077：首屏收件箱可领附件计数与深链 id（ListPlayerMail filter=all，与未读轮询并行）。 */
  mailClaimable: number;
  firstClaimableMailId: number;
  dailyClaimable: number;
  firstClaimableDailyCfgId: number;
  /** 建造进行中首槽（队列角标深链，与 `queueBuildingToolbarBadgeCount` 排序一致）。 */
  firstQueueBuildingSlotKey: string;
};

export const EMPTY_HUD_TODO_DEEP_LINK: HudTodoDeepLinkSnapshot = {
  mailUnread: 0,
  dailyTodo: 0,
  queueBuilding: 0,
  battleReportUnread: 0,
  mailUnreadTotal: 0,
  mailClaimablePage: [],
  firstUnreadMailId: 0,
  firstDailyTodoCfgId: 0,
  firstUnreadBattleReportId: 0,
  dailyChainRows: [],
  mailClaimable: 0,
  firstClaimableMailId: 0,
  dailyClaimable: 0,
  firstClaimableDailyCfgId: 0,
  firstQueueBuildingSlotKey: "",
};

/** 收件箱列表顺序下首封未读（与 unread filter 一致）。 */
export function pickFirstUnreadMailId(mails: MailRow[]): number {
  for (const m of mails) {
    const id = m.mail_id ?? 0;
    if (id > 0 && mailIsUnread(m)) return id;
  }
  return 0;
}

export type MailUnreadSnapshot = { count: number; firstId: number };

/** 与 HudTodoBadgePoll / 底栏角标共用：ListPlayerMail unread 分页首屏快照。 */
export function mailUnreadSnapshotFromListResponse(res: {
  mails?: MailRow[];
  total_count?: number;
}): MailUnreadSnapshot {
  const mails = res.mails ?? [];
  return {
    count: res.total_count ?? 0,
    firstId: pickFirstUnreadMailId(mails),
  };
}

/** chain 400 列表顺序下首条可接取或可领奖。 */
export function pickFirstDailyTodoQuestCfgId(rows: DailyQuestRow[]): number {
  for (const q of rows) {
    const s = q.state ?? 0;
    if (s === DAILY_QUEST_STATE_ACCEPTABLE || s === DAILY_QUEST_STATE_CLAIMABLE) {
      const id = q.quest_cfg_id ?? 0;
      if (id > 0) return id;
    }
  }
  return 0;
}
