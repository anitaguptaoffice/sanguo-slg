import { formatFilterBadgeCount } from "@/engine/artUiFilterSkin";
import type { DailyQuestRow } from "@/net/dailyQuestState";
import { dailyToolbarBadgeCount } from "@/net/hudTodoBadges";

/**
 * CLIENT-123：日常「可领取」筛选角标与 HUD/底栏（CLIENT-107）共用可领条数推导。
 * 展示文案走 ART-UI-FILTER-008 `formatFilterBadgeCount`（1–9 / 9+）；计数为 0 时整块角标隐藏。
 */

/** 与 `dailyToolbarBadgeCount` / CLIENT-107 一致：chain 400 可领奖 state=3。 */
export function dailyQuestClaimableBadgeCount(rows: DailyQuestRow[]): number {
  return dailyToolbarBadgeCount(rows);
}

export function dailyQuestClaimableBadgeCountMatchesHud(
  rows: DailyQuestRow[],
  hudDailyClaimable: number,
): boolean {
  return dailyQuestClaimableBadgeCount(rows) === hudDailyClaimable;
}

/** 面板筛选条 count 角标文案（空串表示隐藏）。 */
export function formatDailyQuestClaimableFilterBadge(rows: DailyQuestRow[]): string {
  return formatFilterBadgeCount(dailyQuestClaimableBadgeCount(rows));
}

export function shouldShowDailyQuestClaimableFilterBadge(rows: DailyQuestRow[]): boolean {
  return dailyQuestClaimableBadgeCount(rows) > 0;
}
