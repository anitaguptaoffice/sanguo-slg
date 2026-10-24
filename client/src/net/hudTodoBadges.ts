import type { CityBuilding } from "@/net/bootstrapSession";
import type { ChatUnreadSummary } from "@/net/chatUnread";
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
import { activeBuildingUpgrades } from "@/net/queueState";

/**
 * CLIENT-107 / CLIENT-162：HUD 待办角标单一事实源（纯函数）。
 * 底栏 toolbar、面板 tab/chip（CLIENT-122/123）与 CLIENT-077 顶栏深链共用本模块；聊天社交段与 CLIENT-102/161 对齐。
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

/** CLIENT-162：面板 tab/入口与底栏社交角标展开（与 `HudTodoSocialBadges` 一一对应）。 */
export type HudTodoSocialPanelBadges = {
  chatToolbar: number;
  guildToolbar: number;
  worldTab: number;
  guildTab: number;
  guildEntry: number;
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

/** 从摘要或 bundle 社交段推导面板角标；`total` 缺省时回退 world+guild。 */
export function chatSocialBadgesFromSummary(
  summary: Pick<ChatUnreadSummary, "world" | "guild" | "total"> | HudTodoSocialBadges,
): HudTodoSocialPanelBadges {
  if ("chat" in summary && !("total" in summary)) {
    const s = summary as HudTodoSocialBadges;
    return {
      chatToolbar: s.chat,
      guildToolbar: s.guild,
      worldTab: s.world,
      guildTab: s.guild,
      guildEntry: s.guild,
    };
  }
  const pick = summary as Pick<ChatUnreadSummary, "world" | "guild" | "total">;
  const world = Math.max(0, pick.world ?? 0);
  const guild = Math.max(0, pick.guild ?? 0);
  const total = Math.max(0, pick.total ?? world + guild);
  return {
    chatToolbar: total,
    guildToolbar: guild,
    worldTab: world,
    guildTab: guild,
    guildEntry: guild,
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

export type HudTodoPanelBadges = {
  mail: { unreadTab: number; unclaimedTab: number };
  daily: { claimableChip: number };
  queue: { inProgress: number };
};

export type HudTodoReconciled = {
  bundle: HudTodoBadgesBundle;
  panel: HudTodoPanelBadges;
  social: HudTodoSocialPanelBadges;
  /** CLIENT-134 深链：轮询快照上的邮件 tab（与 `HudTodoDeepLinkSnapshot` 字段对齐）。 */
  pollMailTabs: { unreadForTab: number; unclaimedCount: number };
};

export type HudTodoReconcileDrift = {
  surface: string;
  expected: number;
  actual: number;
};

/** CLIENT-106 兼容：列表快照下未读∪未领附件条数（同封只计 1，供底栏推导）。 */
export function countMailToolbarUnionFromPage(mails: MailRow[]): number {
  let n = 0;
  for (const m of mails) {
    if (mailIsUnread(m) || mailHasUnclaimedAttachments(m)) n++;
  }
  return n;
}

/** CLIENT-159 单测别名（与 `countMailToolbarUnionFromPage` 同源）。 */
export function countMailUnreadAndUnclaimed(mails: MailRow[]): number {
  return countMailToolbarUnionFromPage(mails);
}

/** CLIENT-122：收件箱 filter=all 快照上的 tab 角标（与面板 DOM 同步）。 */
export function mailPanelTabBadgeCounts(input: {
  mailUnreadTotal: number;
  mailClaimablePage: MailRow[];
}): { unreadTab: number; unclaimedTab: number } {
  const unreadTotal = Math.max(0, input.mailUnreadTotal);
  const inbox = countMailInboxTabBadgeCounts(input.mailClaimablePage ?? []);
  return {
    unreadTab: Math.max(unreadTotal, inbox.unread),
    unclaimedTab: inbox.unclaimed,
  };
}

/** CLIENT-134 深链：轮询快照上的邮件 tab 数字（未读 tab 以 total_count 为准）。 */
export function mailPanelTabBadgeCountsFromPollSnapshot(
  snap: Pick<{ mailUnreadTotal: number; mailClaimable: number }, "mailUnreadTotal" | "mailClaimable">,
): { unreadForTab: number; unclaimedCount: number } {
  return {
    unreadForTab: Math.max(0, snap.mailUnreadTotal),
    unclaimedCount: Math.max(0, snap.mailClaimable),
  };
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
  if (unreadTotal <= 0) return countMailToolbarUnionFromPage(mails);
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

function chatSummaryFromPartial(
  partial?: Pick<ChatUnreadSummary, "world" | "guild" | "total">,
): ChatUnreadSummary | undefined {
  if (!partial) return undefined;
  const world = Math.max(0, partial.world ?? 0);
  const guild = Math.max(0, partial.guild ?? 0);
  const total = Math.max(0, partial.total ?? world + guild);
  return { world, guild, total, byChannel: {} };
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
  const tabs = mailPanelTabBadgeCounts({
    mailUnreadTotal: input.mailUnreadTotal,
    mailClaimablePage: mails,
  });
  const bundle = buildHudTodoBadges({
    mailUnreadTotal: input.mailUnreadTotal,
    mailClaimablePage: mails,
    dailyRows: [],
    buildCompleteCount: 0,
    battleReportUnread: 0,
  });
  return {
    toolbarMail: bundle.toolbar.mail,
    inboxUnread: tabs.unreadTab,
    inboxUnclaimed: tabs.unclaimedTab,
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

/** 聚合 toolbar、顶栏、面板 tab/chip 与社交角标（CLIENT-162）。 */
export function buildHudTodoReconciled(
  input: HudTodoBadgesInputs & {
    chatSummary?: Pick<ChatUnreadSummary, "world" | "guild" | "total">;
  },
): HudTodoReconciled {
  const chatUnread = input.chatUnread ?? chatSummaryFromPartial(input.chatSummary);
  const bundle = buildHudTodoBadges({ ...input, chatUnread });
  const mailTabs = mailPanelTabBadgeCounts({
    mailUnreadTotal: input.mailUnreadTotal,
    mailClaimablePage: input.mailClaimablePage,
  });
  const social = input.chatSummary
    ? chatSocialBadgesFromSummary(input.chatSummary)
    : chatSocialBadgesFromSummary(bundle.social);
  return {
    bundle,
    panel: {
      mail: mailTabs,
      daily: { claimableChip: bundle.toolbar.daily },
      queue: { inProgress: bundle.toolbar.queue },
    },
    social,
    pollMailTabs: mailPanelTabBadgeCountsFromPollSnapshot({
      mailUnreadTotal: input.mailUnreadTotal,
      mailClaimable: bundle.center.mailClaimable,
    }),
  };
}

function pushDrift(
  drifts: HudTodoReconcileDrift[],
  surface: string,
  expected: number,
  actual: number,
): void {
  if (expected !== actual) drifts.push({ surface, expected, actual });
}

/**
 * 校验底栏与面板 tab/chip、社交入口 **零漂移**；返回非空列表表示不一致。
 */
export function reconcileHudTodoBadges(reconciled: HudTodoReconciled): HudTodoReconcileDrift[] {
  const drifts: HudTodoReconcileDrift[] = [];
  const { bundle, panel, social } = reconciled;
  const toolbar = bundle.toolbar;
  const center = bundle.center;
  const bundleSocial = chatSocialBadgesFromSummary(bundle.social);

  pushDrift(drifts, "toolbar.daily", toolbar.daily, panel.daily.claimableChip);
  pushDrift(drifts, "toolbar.queue", toolbar.queue, panel.queue.inProgress);
  pushDrift(drifts, "center.mailClaimable", center.mailClaimable, panel.mail.unclaimedTab);
  pushDrift(drifts, "center.dailyClaimable", center.dailyClaimable, panel.daily.claimableChip);
  pushDrift(drifts, "social.chatToolbar", bundleSocial.chatToolbar, social.chatToolbar);
  pushDrift(drifts, "social.guildToolbar", bundleSocial.guildToolbar, social.guildToolbar);
  pushDrift(drifts, "social.worldTab", bundleSocial.worldTab, social.worldTab);
  pushDrift(drifts, "social.guildTab", bundleSocial.guildTab, social.guildTab);
  pushDrift(drifts, "social.chatTotal", social.chatToolbar, social.worldTab + social.guildTab);
  pushDrift(drifts, "social.guildToolbar", social.guildToolbar, social.guildTab);
  pushDrift(drifts, "social.guildTab", social.guildTab, social.guildEntry);

  const pollMail = reconciled.pollMailTabs;
  pushDrift(drifts, "mail.pollUnclaimedTab", pollMail.unclaimedCount, panel.mail.unclaimedTab);
  if (panel.mail.unreadTab < pollMail.unreadForTab) {
    drifts.push({
      surface: "mail.pollUnreadTab",
      expected: pollMail.unreadForTab,
      actual: panel.mail.unreadTab,
    });
  }

  return drifts;
}
