import { BattleReportUnreadSession } from "@/net/battleReportUnread";
import { DAILY_QUEST_CHAIN_ID, dailyQuestsFromListResponse, type DailyQuestRow } from "@/net/dailyQuestState";
import type { GatewayPort } from "@/net/GatewayClient";
import { MAIL_INBOX_FILTER_UNREAD, type MailRow } from "@/net/heroMailState";
import {
  aggregateHudTodoCounts,
  countDailyTodoQuests,
  EMPTY_HUD_TODO_DEEP_LINK,
  pickFirstDailyTodoQuestCfgId,
  pickFirstUnreadMailId,
  type HudTodoBadgeCounts,
  type HudTodoDeepLinkSnapshot,
} from "@/net/hudTodoBadge";
import {
  CITY_STATE_POLL_FAST_SEC,
  CITY_STATE_POLL_SLOW_SEC,
} from "@/net/cityStatePoll";

export type HudTodoBadgePollOptions = {
  gateway: GatewayPort;
  getServerId: () => number;
  getCityId: () => number | null;
  battleReportUnread: BattleReportUnreadSession;
  /** 与 CityStatePoll 相同：任意面板打开时较快轮询。 */
  isPanelVisible: () => boolean;
  isMailSuppressed: () => boolean;
  isDailySuppressed: () => boolean;
  isReportsSuppressed: () => boolean;
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
  private dailyInflight: Promise<{ count: number; firstId: number; rows: DailyQuestRow[] }> | null =
    null;
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

  reset(): void {
    this.accumSec = 0;
    this.mailInflight = null;
    this.dailyInflight = null;
    this.reportsInflight = null;
    this.deepLink = { ...EMPTY_HUD_TODO_DEEP_LINK };
  }

  tick(dtSec: number): void {
    const interval = this.opts.isPanelVisible() ? this.fastSec : this.slowSec;
    this.accumSec += dtSec;
    if (this.accumSec < interval) return;
    this.accumSec = 0;
    void this.pollOnce();
  }

  async pollOnce(): Promise<void> {
    const [mail, daily, reports] = await Promise.all([
      this.opts.isMailSuppressed()
        ? { count: 0, firstId: 0 }
        : this.fetchMailSnapshot(),
      this.opts.isDailySuppressed()
        ? { count: 0, firstId: 0, rows: [] }
        : this.fetchDailySnapshot(),
      this.opts.isReportsSuppressed()
        ? { count: 0, firstId: 0 }
        : this.fetchBattleReportSnapshot(),
    ]);
    this.deepLink = {
      ...aggregateHudTodoCounts({
        mailUnread: mail.count,
        dailyTodo: daily.count,
        battleReportUnread: reports.count,
      }),
      firstUnreadMailId: mail.firstId,
      firstDailyTodoCfgId: daily.firstId,
      firstUnreadBattleReportId: reports.firstId,
      dailyChainRows: daily.rows,
    };
    this.opts.onCounts(this.deepLink);
  }

  private fetchMailSnapshot(): Promise<{ count: number; firstId: number }> {
    if (this.mailInflight) return this.mailInflight;
    const sid = this.opts.getServerId();
    if (!sid) return Promise.resolve({ count: 0, firstId: 0 });
    const p = this.opts.gateway
      .listPlayerMail(sid, { filter: MAIL_INBOX_FILTER_UNREAD, pageSize: 1, pageOffset: 0 })
      .then((res) => {
        const mails = (res as { mails?: MailRow[] }).mails ?? [];
        const count = (res as { total_count?: number }).total_count ?? 0;
        const firstId = pickFirstUnreadMailId(mails);
        return { count, firstId };
      })
      .catch(() => ({ count: 0, firstId: 0 }))
      .finally(() => {
        if (this.mailInflight === p) this.mailInflight = null;
      });
    this.mailInflight = p;
    return p;
  }

  private fetchDailySnapshot(): Promise<{
    count: number;
    firstId: number;
    rows: DailyQuestRow[];
  }> {
    if (this.dailyInflight) return this.dailyInflight;
    const sid = this.opts.getServerId();
    if (!sid) return Promise.resolve({ count: 0, firstId: 0, rows: [] });
    const p = this.opts.gateway
      .listPlayerQuests(sid, { chainId: DAILY_QUEST_CHAIN_ID, includeCompleted: true })
      .then((res) => {
        const rows = dailyQuestsFromListResponse(res as { quests?: DailyQuestRow[] });
        return {
          count: countDailyTodoQuests(rows),
          firstId: pickFirstDailyTodoQuestCfgId(rows),
          rows,
        };
      })
      .catch(() => ({ count: 0, firstId: 0, rows: [] }))
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
