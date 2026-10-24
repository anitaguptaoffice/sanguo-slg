import { BattleReportUnreadSession } from "@/net/battleReportUnread";
import { DAILY_QUEST_CHAIN_ID, dailyQuestsFromListResponse, type DailyQuestRow } from "@/net/dailyQuestState";
import type { GatewayPort } from "@/net/GatewayClient";
import { MAIL_INBOX_FILTER_ALL, MAIL_INBOX_FILTER_UNREAD, type MailRow } from "@/net/heroMailState";
import type { CityBuilding } from "@/net/bootstrapSession";
import {
  pickFirstClaimableDailyQuestCfgId,
  pickFirstClaimableMailId,
} from "@/net/hudCenterTodo";
import {
  EMPTY_HUD_TODO_DEEP_LINK,
  mailUnreadSnapshotFromListResponse,
  pickFirstDailyTodoQuestCfgId,
  type HudTodoBadgeCounts,
  type HudTodoDeepLinkSnapshot,
} from "@/net/hudTodoBadge";
import { buildHudTodoBadges } from "@/net/hudTodoBadges";
import { pickFirstQueueBuildingSlotKey } from "@/net/hudTodoOpenTarget";
import {
  CITY_STATE_POLL_FAST_SEC,
  CITY_STATE_POLL_SLOW_SEC,
} from "@/net/cityStatePoll";

export type HudTodoBadgePollOptions = {
  gateway: GatewayPort;
  getServerId: () => number;
  getCityId: () => number | null;
  getBuildings: () => CityBuilding[] | undefined;
  getBuildCompleteCount: () => number;
  battleReportUnread: BattleReportUnreadSession;
  /** 与 CityStatePoll 相同：任意面板打开时较快轮询。 */
  isPanelVisible: () => boolean;
  isMailSuppressed: () => boolean;
  isDailySuppressed: () => boolean;
  isReportsSuppressed: () => boolean;
  isQueueSuppressed: () => boolean;
  onCounts: (counts: HudTodoBadgeCounts) => void;
  fastIntervalSec?: number;
  slowIntervalSec?: number;
};

/** 待办角标轮询：各来源独立单飞，间隔与 CLIENT-018 GetCityState 降频策略对齐。 */
export class HudTodoBadgePoll {
  private accumSec = 0;
  private readonly fastSec: number;
  private readonly slowSec: number;
  private mailInflight: Promise<{ count: number; firstId: number }> | null = null;
  private mailClaimableInflight: Promise<{ count: number; firstId: number; mails: MailRow[] }> | null =
    null;
  private dailyInflight: Promise<{
    count: number;
    firstId: number;
    claimableCount: number;
    claimableFirstId: number;
    rows: DailyQuestRow[];
  }> | null = null;
  private reportsInflight: Promise<{ count: number; firstId: number }> | null = null;
  private deepLink: HudTodoDeepLinkSnapshot = { ...EMPTY_HUD_TODO_DEEP_LINK };

  constructor(private readonly opts: HudTodoBadgePollOptions) {
    this.fastSec = opts.fastIntervalSec ?? CITY_STATE_POLL_FAST_SEC;
    this.slowSec = opts.slowIntervalSec ?? CITY_STATE_POLL_SLOW_SEC;
  }

  /** 最近一次轮询快照，供角标深链复用（不再为选首条 id 单独 RPC）。 */
  getDeepLinkSnapshot(): Readonly<HudTodoDeepLinkSnapshot> {
    return this.deepLink;
  }

  /** GetCityState 建造队列变更后重算队列角标（不额外 RPC）。 */
  recomputeToolbarCounts(): void {
    const dl = this.deepLink;
    this.deepLink = {
      ...dl,
      ...this.toolbarCountsFromParts({
        mailUnreadTotal: dl.mailUnreadTotal,
        mailClaimablePage: dl.mailClaimablePage,
        dailyRows: dl.dailyChainRows,
        battleReportUnread: dl.battleReportUnread,
      }),
      firstQueueBuildingSlotKey: pickFirstQueueBuildingSlotKey(this.opts.getBuildings()),
    };
    this.opts.onCounts(this.toolbarCountsForUi());
  }

  reset(): void {
    this.accumSec = 0;
    this.mailInflight = null;
    this.mailClaimableInflight = null;
    this.dailyInflight = null;
    this.reportsInflight = null;
    this.deepLink = { ...EMPTY_HUD_TODO_DEEP_LINK };
  }

  /** 领取附件等局部刷新后写入邮件未读快照，避免等关面板再 poll。 */
  applyMailUnreadSnapshot(count: number, firstUnreadMailId = 0): void {
    const mailUnreadTotal = Math.max(0, count);
    const firstId =
      firstUnreadMailId > 0
        ? firstUnreadMailId
        : mailUnreadTotal > 0
          ? this.deepLink.firstUnreadMailId
          : 0;
    this.deepLink = {
      ...this.deepLink,
      mailUnreadTotal,
      firstUnreadMailId: firstId,
      ...this.toolbarCountsFromParts({
        mailUnreadTotal,
        mailClaimablePage: this.deepLink.mailClaimablePage,
        dailyRows: this.deepLink.dailyChainRows,
        battleReportUnread: this.deepLink.battleReportUnread,
      }),
    };
    if (!this.opts.isMailSuppressed()) {
      this.opts.onCounts(this.toolbarCountsForUi());
    }
  }

  tick(dtSec: number): void {
    const interval = this.opts.isPanelVisible() ? this.fastSec : this.slowSec;
    this.accumSec += dtSec;
    if (this.accumSec < interval) return;
    this.accumSec = 0;
    void this.pollOnce();
  }

  async pollOnce(): Promise<void> {
    const [mail, mailClaimable, daily, reports] = await Promise.all([
      this.opts.isMailSuppressed()
        ? { count: 0, firstId: 0 }
        : this.fetchMailSnapshot(),
      this.opts.isMailSuppressed()
        ? { count: 0, firstId: 0, mails: [] }
        : this.fetchMailClaimableSnapshot(),
      this.opts.isDailySuppressed()
        ? { count: 0, firstId: 0, claimableCount: 0, claimableFirstId: 0, rows: [] }
        : this.fetchDailySnapshot(),
      this.opts.isReportsSuppressed()
        ? { count: 0, firstId: 0 }
        : this.fetchBattleReportSnapshot(),
    ]);
    const mailClaimablePage = mailClaimable.mails;
    const toolbarParts = this.toolbarCountsFromParts({
      mailUnreadTotal: mail.count,
      mailClaimablePage,
      dailyRows: daily.rows,
      battleReportUnread: reports.count,
    });
    const buildings = this.opts.getBuildings();
    this.deepLink = {
      ...toolbarParts,
      mailUnreadTotal: mail.count,
      mailClaimablePage,
      firstUnreadMailId: mail.firstId,
      firstDailyTodoCfgId: daily.firstId,
      firstUnreadBattleReportId: reports.firstId,
      dailyChainRows: daily.rows,
      mailClaimable: mailClaimable.count,
      firstClaimableMailId: mailClaimable.firstId,
      dailyClaimable: daily.claimableCount,
      firstClaimableDailyCfgId: daily.claimableFirstId,
      firstQueueBuildingSlotKey: pickFirstQueueBuildingSlotKey(buildings),
    };
    this.opts.onCounts(this.toolbarCountsForUi());
  }

  private toolbarCountsFromParts(parts: {
    mailUnreadTotal: number;
    mailClaimablePage: MailRow[];
    dailyRows: DailyQuestRow[];
    battleReportUnread: number;
  }): HudTodoBadgeCounts {
    const bundle = buildHudTodoBadges({
      mailUnreadTotal: parts.mailUnreadTotal,
      mailClaimablePage: parts.mailClaimablePage,
      dailyRows: parts.dailyRows,
      buildings: this.opts.getBuildings(),
      buildCompleteCount: this.opts.getBuildCompleteCount(),
      battleReportUnread: parts.battleReportUnread,
    });
    return {
      mailUnread: bundle.toolbar.mail,
      dailyTodo: bundle.toolbar.daily,
      queueBuilding: bundle.toolbar.queue,
      battleReportUnread: bundle.toolbar.reports,
    };
  }

  private toolbarCountsForUi(): HudTodoBadgeCounts {
    let counts: HudTodoBadgeCounts = {
      mailUnread: this.deepLink.mailUnread,
      dailyTodo: this.deepLink.dailyTodo,
      queueBuilding: this.deepLink.queueBuilding,
      battleReportUnread: this.deepLink.battleReportUnread,
    };
    if (this.opts.isMailSuppressed()) counts = { ...counts, mailUnread: 0 };
    if (this.opts.isDailySuppressed()) counts = { ...counts, dailyTodo: 0 };
    if (this.opts.isReportsSuppressed()) counts = { ...counts, battleReportUnread: 0 };
    if (this.opts.isQueueSuppressed()) counts = { ...counts, queueBuilding: 0 };
    return counts;
  }

  private fetchMailSnapshot(): Promise<{ count: number; firstId: number }> {
    if (this.mailInflight) return this.mailInflight;
    const sid = this.opts.getServerId();
    if (!sid) return Promise.resolve({ count: 0, firstId: 0 });
    const p = this.opts.gateway
      .listPlayerMail(sid, { filter: MAIL_INBOX_FILTER_UNREAD, pageSize: 1, pageOffset: 0 })
      .then((res) => {
        const snap = mailUnreadSnapshotFromListResponse(res as { mails?: MailRow[]; total_count?: number });
        return { count: snap.count, firstId: snap.firstId };
      })
      .catch(() => ({ count: 0, firstId: 0 }))
      .finally(() => {
        if (this.mailInflight === p) this.mailInflight = null;
      });
    this.mailInflight = p;
    return p;
  }

  private fetchMailClaimableSnapshot(): Promise<{ count: number; firstId: number; mails: MailRow[] }> {
    if (this.mailClaimableInflight) return this.mailClaimableInflight;
    const sid = this.opts.getServerId();
    if (!sid) return Promise.resolve({ count: 0, firstId: 0, mails: [] });
    const p = this.opts.gateway
      .listPlayerMail(sid, { filter: MAIL_INBOX_FILTER_ALL, pageSize: 50, pageOffset: 0 })
      .then((res) => {
        const mails = (res as { mails?: MailRow[] }).mails ?? [];
        const bundle = buildHudTodoBadges({
          mailUnreadTotal: 0,
          mailClaimablePage: mails,
          dailyRows: [],
          buildCompleteCount: 0,
          battleReportUnread: 0,
        });
        return {
          count: bundle.center.mailClaimable,
          firstId: pickFirstClaimableMailId(mails),
          mails,
        };
      })
      .catch(() => ({ count: 0, firstId: 0, mails: [] }))
      .finally(() => {
        if (this.mailClaimableInflight === p) this.mailClaimableInflight = null;
      });
    this.mailClaimableInflight = p;
    return p;
  }

  private fetchDailySnapshot(): Promise<{
    count: number;
    firstId: number;
    claimableCount: number;
    claimableFirstId: number;
    rows: DailyQuestRow[];
  }> {
    if (this.dailyInflight) return this.dailyInflight;
    const sid = this.opts.getServerId();
    if (!sid) {
      return Promise.resolve({
        count: 0,
        firstId: 0,
        claimableCount: 0,
        claimableFirstId: 0,
        rows: [],
      });
    }
    const p = this.opts.gateway
      .listPlayerQuests(sid, { chainId: DAILY_QUEST_CHAIN_ID, includeCompleted: true })
      .then((res) => {
        const rows = dailyQuestsFromListResponse(res as { quests?: DailyQuestRow[] });
        const bundle = buildHudTodoBadges({
          mailUnreadTotal: 0,
          mailClaimablePage: [],
          dailyRows: rows,
          buildCompleteCount: 0,
          battleReportUnread: 0,
        });
        return {
          count: bundle.toolbar.daily,
          firstId: pickFirstClaimableDailyQuestCfgId(rows) || pickFirstDailyTodoQuestCfgId(rows),
          claimableCount: bundle.center.dailyClaimable,
          claimableFirstId: pickFirstClaimableDailyQuestCfgId(rows),
          rows,
        };
      })
      .catch(() => ({
        count: 0,
        firstId: 0,
        claimableCount: 0,
        claimableFirstId: 0,
        rows: [],
      }))
      .finally(() => {
        if (this.dailyInflight === p) this.dailyInflight = null;
      });
    this.dailyInflight = p;
    return p;
  }

  private fetchBattleReportSnapshot(): Promise<{ count: number; firstId: number }> {
    if (this.reportsInflight) return this.reportsInflight;
    const cityId = this.opts.getCityId();
    if (!cityId) return Promise.resolve({ count: 0, firstId: 0 });
    const p = this.opts.gateway
      .listBattleReports(20, 0)
      .then((res) => {
        const reports = (res as { reports?: { report_id?: number }[] }).reports ?? [];
        const count = this.opts.battleReportUnread.countUnread(reports);
        const firstId = this.opts.battleReportUnread.firstUnreadReportId(reports);
        return { count, firstId };
      })
      .catch(() => ({ count: 0, firstId: 0 }))
      .finally(() => {
        if (this.reportsInflight === p) this.reportsInflight = null;
      });
    this.reportsInflight = p;
    return p;
  }
}
