import type { CityBuilding } from "@/net/bootstrapSession";
import type { DailyQuestRow } from "@/net/dailyQuestState";
import type { MailRow } from "@/net/heroMailState";
import {
  countMailUnreadAndUnclaimed as countMailInboxTabBadgeCounts,
  mailHasUnclaimedAttachments,
  mailIsUnread,
} from "@/net/heroMailState";
import {
  countClaimableDailyQuests,
  countClaimableMails,
  type HudCenterTodoCounts,
} from "@/net/hudCenterTodo";
import { formatBadgeCount } from "@/engine/artBadgeSkin";
import type { ChatUnreadSummary } from "@/net/chatUnread";
import { activeBuildingUpgrades } from "@/net/queueState";

/**
 * CLIENT-107：HUD 待办角标单一事实源（纯函数）。
 * 底栏 toolbar 与 CLIENT-077 顶栏深链共用本模块推导的计数，不与 CLIENT-102 聊天角标重复汇总。
 */

export type HudTodoToolbarBadges = {
  /** 邮件：未读 ∪ 未领附件（去重，CLIENT-106 口径） */
  mail: number;
  /** 日常：可领取 state=3（CLIENT-091） */
  daily: number;
  /** 队列：建造进行中槽位（upgrade_finish_at_ms > now） */
  queue: number;
  /** 战报：相对上次打开的新战报（CLIENT-027/025） */
  reports: number;
};

/** CLIENT-161：聊天/军团社交角标（与 ChatUnreadTracker 估算同源，不并入顶栏待办总和）。 */
export type HudTodoSocialBadges = {
  /** 底栏「聊天」：世界 + 军团未读之和 */
  chat: number;
  /** 聊天面板世界 tab */
  world: number;
  /** 底栏「军团」、聊天军团 tab、军团面板入口 */
  guild: number;
};

export function hudTodoSocialBadgesFromChatSummary(
  summary: ChatUnreadSummary,
): HudTodoSocialBadges {
  return {
    chat: Math.max(0, summary.total),
    world: Math.max(0, summary.world),
    guild: Math.max(0, summary.guild),
  };
}

export type HudTodoBadgesInputs = {
  mailUnreadTotal: number;
  mailClaimablePage: MailRow[];
  dailyRows: DailyQuestRow[];
  buildings?: CityBuilding[];
  buildCompleteCount: number;
  battleReportUnread: number;
  chatUnread?: ChatUnreadSummary;
  nowMs?: number;
};

export type HudTodoBadgesBundle = {
  toolbar: HudTodoToolbarBadges;
  center: HudCenterTodoCounts;
  social: HudTodoSocialBadges;
};

/** CLIENT-106 兼容：列表快照下未读与未领附件合并条数（同封只计 1）。 */
export function countMailUnreadAndUnclaimed(mails: MailRow[]): number {
  let n = 0;
  for (const m of mails) {
    if (mailIsUnread(m) || mailHasUnclaimedAttachments(m)) n++;
  }
  return n;
}

/**
 * 邮件底栏角标：以未读 total_count 为准，并加上首屏中「已读但未领附件」条数（避免与未读重复计数）。
 */
export function mailToolbarBadgeCount(input: {
  unreadTotal: number;
  mailClaimablePage: MailRow[];
}): number {
  const unreadTotal = Math.max(0, input.unreadTotal);
  const mails = input.mailClaimablePage ?? [];
  if (!mails.length) return unreadTotal;
  const readUnclaimed = mails.filter(
    (m) => !mailIsUnread(m) && mailHasUnclaimedAttachments(m),
  ).length;
  if (unreadTotal <= 0) return countMailUnreadAndUnclaimed(mails);
  return unreadTotal + readUnclaimed;
}

export function dailyToolbarBadgeCount(rows: DailyQuestRow[]): number {
  return countClaimableDailyQuests(rows);
}

export function queueBuildingToolbarBadgeCount(
  buildings: CityBuilding[] | undefined,
  nowMs = Date.now(),
): number {
  return activeBuildingUpgrades(buildings, nowMs).length;
}

export function buildHudCenterTodoCounts(input: {
  mailClaimablePage: MailRow[];
  dailyRows: DailyQuestRow[];
  buildCompleteCount: number;
}): HudCenterTodoCounts {
  return {
    mailClaimable: countClaimableMails(input.mailClaimablePage ?? []),
    dailyClaimable: countClaimableDailyQuests(input.dailyRows ?? []),
    buildComplete: Math.max(0, input.buildCompleteCount),
  };
}

/** 聚合 toolbar + CLIENT-077 顶栏待办计数。 */
export function buildHudTodoBadges(input: HudTodoBadgesInputs): HudTodoBadgesBundle {
  const nowMs = input.nowMs ?? Date.now();
  const mailPage = input.mailClaimablePage ?? [];
  const dailyRows = input.dailyRows ?? [];
  const center = buildHudCenterTodoCounts({
    mailClaimablePage: mailPage,
    dailyRows,
    buildCompleteCount: input.buildCompleteCount,
  });
  const social = input.chatUnread
    ? hudTodoSocialBadgesFromChatSummary(input.chatUnread)
    : { chat: 0, world: 0, guild: 0 };
  return {
    toolbar: {
      mail: mailToolbarBadgeCount({
        unreadTotal: input.mailUnreadTotal,
        mailClaimablePage: mailPage,
      }),
      daily: dailyToolbarBadgeCount(dailyRows),
      queue: queueBuildingToolbarBadgeCount(input.buildings, nowMs),
      reports: Math.max(0, input.battleReportUnread),
    },
    center,
    social,
  };
}

export function sumHudCenterTodoFromBundle(bundle: HudTodoBadgesBundle): number {
  const c = bundle.center;
  return Math.max(0, c.mailClaimable) + Math.max(0, c.dailyClaimable) + Math.max(0, c.buildComplete);
}

/** CLIENT-126：顶栏待办数字角标文案（与 manifest count 槽 1–9 / 9+ 一致）。 */
export function formatHudToolbarBadgeText(count: number): string {
  return formatBadgeCount(count);
}

export function formatHudCenterTodoBadgeFromBundle(bundle: HudTodoBadgesBundle): string {
  return formatBadgeCount(sumHudCenterTodoFromBundle(bundle));
}

/** CLIENT-159：邮件 HUD / tab / 深链可领计数同一快照切面（单测角标 diff）。 */
export type MailHudBadgeFacetCounts = {
  toolbarMail: number;
  inboxUnread: number;
  inboxUnclaimed: number;
  deepLinkMailClaimable: number;
};

export function mailHudBadgeFacetCounts(input: {
  mailUnreadTotal: number;
  mailInboxSnapshot: MailRow[];
}): MailHudBadgeFacetCounts {
  const mails = input.mailInboxSnapshot ?? [];
  const tab = countMailInboxTabBadgeCounts(mails);
  const bundle = buildHudTodoBadges({
    mailUnreadTotal: input.mailUnreadTotal,
    mailClaimablePage: mails,
    dailyRows: [],
    buildCompleteCount: 0,
    battleReportUnread: 0,
  });
  return {
    toolbarMail: bundle.toolbar.mail,
    inboxUnread: Math.max(0, input.mailUnreadTotal, tab.unread),
    inboxUnclaimed: tab.unclaimed,
    deepLinkMailClaimable: bundle.center.mailClaimable,
  };
}

export function diffHudTodoMailBadgeCounts(
  before: MailHudBadgeFacetCounts,
  after: MailHudBadgeFacetCounts,
): MailHudBadgeFacetCounts {
  return {
    toolbarMail: after.toolbarMail - before.toolbarMail,
    inboxUnread: after.inboxUnread - before.inboxUnread,
    inboxUnclaimed: after.inboxUnclaimed - before.inboxUnclaimed,
    deepLinkMailClaimable: after.deepLinkMailClaimable - before.deepLinkMailClaimable,
  };
}
