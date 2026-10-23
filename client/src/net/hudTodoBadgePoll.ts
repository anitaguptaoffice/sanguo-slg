import { BattleReportUnreadSession } from "@/net/battleReportUnread";
import { DAILY_QUEST_CHAIN_ID, dailyQuestsFromListResponse, type DailyQuestRow } from "@/net/dailyQuestState";
import type { GatewayPort } from "@/net/GatewayClient";
import { MAIL_INBOX_FILTER_UNREAD } from "@/net/heroMailState";
import {
  aggregateHudTodoCounts,
  countDailyTodoQuests,
  type HudTodoBadgeCounts,
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
  private mailInflight: Promise<number> | null = null;
  private dailyInflight: Promise<number> | null = null;
  private reportsInflight: Promise<number> | null = null;

  constructor(private readonly opts: HudTodoBadgePollOptions) {
    this.fastSec = opts.fastIntervalSec ?? CITY_STATE_POLL_FAST_SEC;
    this.slowSec = opts.slowIntervalSec ?? CITY_STATE_POLL_SLOW_SEC;
  }

  reset(): void {
    this.accumSec = 0;
    this.mailInflight = null;
    this.dailyInflight = null;
    this.reportsInflight = null;
  }

  tick(dtSec: number): void {
    const interval = this.opts.isPanelVisible() ? this.fastSec : this.slowSec;
    this.accumSec += dtSec;
    if (this.accumSec < interval) return;
    this.accumSec = 0;
    void this.pollOnce();
  }

  async pollOnce(): Promise<void> {
    const [mailUnread, dailyTodo, battleReportUnread] = await Promise.all([
      this.opts.isMailSuppressed() ? 0 : this.fetchMailUnread(),
      this.opts.isDailySuppressed() ? 0 : this.fetchDailyTodo(),
      this.opts.isReportsSuppressed() ? 0 : this.fetchBattleReportUnread(),
    ]);
    this.opts.onCounts(
      aggregateHudTodoCounts({ mailUnread, dailyTodo, battleReportUnread }),
    );
  }

  private fetchMailUnread(): Promise<number> {
    if (this.mailInflight) return this.mailInflight;
    const sid = this.opts.getServerId();
    if (!sid) return Promise.resolve(0);
    const p = this.opts.gateway
      .listPlayerMail(sid, { filter: MAIL_INBOX_FILTER_UNREAD, pageSize: 1, pageOffset: 0 })
      .then((res) => (res as { total_count?: number }).total_count ?? 0)
      .catch(() => 0)
      .finally(() => {
        if (this.mailInflight === p) this.mailInflight = null;
      });
    this.mailInflight = p;
    return p;
  }

  private fetchDailyTodo(): Promise<number> {
    if (this.dailyInflight) return this.dailyInflight;
    const sid = this.opts.getServerId();
    if (!sid) return Promise.resolve(0);
    const p = this.opts.gateway
      .listPlayerQuests(sid, { chainId: DAILY_QUEST_CHAIN_ID, includeCompleted: true })
      .then((res) => {
        const rows = dailyQuestsFromListResponse(res as { quests?: DailyQuestRow[] });
        return countDailyTodoQuests(rows);
      })
      .catch(() => 0)
      .finally(() => {
        if (this.dailyInflight === p) this.dailyInflight = null;
      });
    this.dailyInflight = p;
    return p;
  }

  private fetchBattleReportUnread(): Promise<number> {
    if (this.reportsInflight) return this.reportsInflight;
    const cityId = this.opts.getCityId();
    if (!cityId) return Promise.resolve(0);
    const p = this.opts.gateway
      .listBattleReports(20, 0)
      .then((res) => {
        const reports = (res as { reports?: { report_id?: number }[] }).reports ?? [];
        return this.opts.battleReportUnread.countUnread(reports);
      })
      .catch(() => 0)
      .finally(() => {
        if (this.reportsInflight === p) this.reportsInflight = null;
      });
    this.reportsInflight = p;
    return p;
  }
}
