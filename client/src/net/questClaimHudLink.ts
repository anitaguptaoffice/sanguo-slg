import type { DailyQuestRow } from "@/net/dailyQuestState";
import {
  countClaimableDailyQuests,
  pickFirstClaimableDailyQuestCfgId,
} from "@/net/hudCenterTodo";
import { formatMailTabUnreadSweepLine } from "@/net/mailTabUnreadSweep";

/** CLIENT-209：日常可领取首条 HUD 待办深链扫读（ListPlayerQuests chain 400 快照，无新 RPC）。 */
export function formatQuestClaimHudLinkLine(rows: DailyQuestRow[]): string | null {
  const claimable = countClaimableDailyQuests(rows);
  if (claimable <= 0) return null;
  const firstId = pickFirstClaimableDailyQuestCfgId(rows);
  if (firstId > 0) return `日常可领 ${claimable} · #${firstId}`;
  return `日常可领 ${claimable}`;
}

/** 邮件未读/未领扫读与日常首条可领合并行（CLIENT-193 `formatHudTodoSweepLine` 底栏 title 不退化）。 */
export function formatMailDailyHudCombinedSweepLine(input: {
  mailTabSweep: string | null;
  questClaimHud: string | null;
}): string | null {
  const parts = [input.mailTabSweep, input.questClaimHud].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
  return parts.length ? parts.join(" · ") : null;
}

export function formatMailPanelHudCombinedSweepLine(
  mailCounts: { unreadForTab: number; unclaimedCount: number },
  dailyRows: DailyQuestRow[],
): string | null {
  const mailTabSweep = formatMailTabUnreadSweepLine("all", mailCounts);
  const questClaimHud = formatQuestClaimHudLinkLine(dailyRows);
  return formatMailDailyHudCombinedSweepLine({ mailTabSweep, questClaimHud });
}
