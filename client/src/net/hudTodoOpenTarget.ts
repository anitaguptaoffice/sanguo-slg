import type { CityBuilding } from "@/net/bootstrapSession";
import type { DailyQuestListFilter } from "@/net/dailyQuestListFilter";
import { MAIL_INBOX_FILTER_ALL, MAIL_INBOX_FILTER_UNREAD } from "@/net/heroMailState";
import type { HudTodoDeepLinkSnapshot } from "@/net/hudTodoBadge";
import { activeBuildingUpgrades } from "@/net/queueState";

/** 底栏 `data-action` 与角标深链解析入口（CLIENT-134 / CLIENT-038）。 */
export type HudTodoToolbarAction =
  | "toggle-mail"
  | "toggle-daily"
  | "toggle-queue"
  | "toggle-reports";

export type HudTodoOpenTarget =
  | { kind: "none" }
  | {
      kind: "mail";
      mailId: number;
      mailFilter: typeof MAIL_INBOX_FILTER_ALL | typeof MAIL_INBOX_FILTER_UNREAD;
      /** CLIENT-122 chip 角标：未读 total（与轮询快照一致）。 */
      unreadForTab: number;
      /** CLIENT-122「全部」chip 角标：可领附件条数。 */
      unclaimedCount: number;
    }
  | {
      kind: "daily";
      cfgId: number;
      listFilter: DailyQuestListFilter;
      /** CLIENT-123「可领取」chip 角标（与 `dailyClaimable` 同源）。 */
      claimableCount: number;
    }
  | { kind: "queue-building"; slotKey: string }
  | { kind: "battle-report"; reportId: number };

export function pickFirstQueueBuildingSlotKey(
  buildings: CityBuilding[] | undefined,
  nowMs = Date.now(),
): string {
  const first = activeBuildingUpgrades(buildings, nowMs)[0];
  return (first?.slot_key ?? "").trim();
}

/** CLIENT-122：邮件筛选 tab 数字与 `HudTodoDeepLinkSnapshot` 对齐。 */
export function mailFilterTabCountsFromHudDeepLink(
  snap: Pick<HudTodoDeepLinkSnapshot, "mailUnreadTotal" | "mailClaimable">,
): { unreadForTab: number; unclaimedCount: number } {
  return {
    unreadForTab: Math.max(0, snap.mailUnreadTotal),
    unclaimedCount: Math.max(0, snap.mailClaimable),
  };
}

/**
 * 角标点击深链落点：与 CLIENT-122/123 筛选 chip 选中态一致；
 * `mail-inbox-filter-v1` / `daily-quest-filter` 记忆键名不变，仅写入深链所需 filter。
 */
export function resolveHudTodoOpenTarget(
  action: HudTodoToolbarAction,
  snap: HudTodoDeepLinkSnapshot,
  buildings?: CityBuilding[],
  nowMs = Date.now(),
): HudTodoOpenTarget {
  const tabCounts = mailFilterTabCountsFromHudDeepLink(snap);
  switch (action) {
    case "toggle-mail": {
      if (snap.mailUnread <= 0) return { kind: "none" };
      if (snap.mailUnreadTotal > 0) {
        return {
          kind: "mail",
          mailId: snap.firstUnreadMailId,
          mailFilter: MAIL_INBOX_FILTER_UNREAD,
          ...tabCounts,
        };
      }
      if (snap.mailClaimable > 0) {
        return {
          kind: "mail",
          mailId: snap.firstClaimableMailId,
          mailFilter: MAIL_INBOX_FILTER_ALL,
          ...tabCounts,
        };
      }
      return { kind: "none" };
    }
    case "toggle-daily": {
      if (snap.dailyTodo <= 0) return { kind: "none" };
      if (snap.dailyClaimable > 0) {
        return {
          kind: "daily",
          cfgId: snap.firstClaimableDailyCfgId,
          listFilter: "claimable",
          claimableCount: snap.dailyClaimable,
        };
      }
      const cfgId = snap.firstDailyTodoCfgId;
      if (cfgId <= 0) return { kind: "none" };
      return {
        kind: "daily",
        cfgId,
        listFilter: "all",
        claimableCount: snap.dailyClaimable,
      };
    }
    case "toggle-queue": {
      if (snap.queueBuilding <= 0) return { kind: "none" };
      const slotKey =
        (snap.firstQueueBuildingSlotKey ?? "").trim() ||
        pickFirstQueueBuildingSlotKey(buildings, nowMs);
      if (!slotKey) return { kind: "none" };
      return { kind: "queue-building", slotKey };
    }
    case "toggle-reports": {
      if (snap.battleReportUnread <= 0) return { kind: "none" };
      return { kind: "battle-report", reportId: snap.firstUnreadBattleReportId };
    }
    default:
      return { kind: "none" };
  }
}
