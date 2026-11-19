import type { DailyQuestRow } from "@/net/dailyQuestState";
import {
  countClaimableDailyQuests,
  pickFirstClaimableDailyQuestCfgId,
} from "@/net/hudCenterTodo";

/** CLIENT-209：日常可领取首条 HUD 待办深链扫读（ListPlayerQuests chain 400 快照，无新 RPC）。 */
export function formatQuestClaimHudLinkLine(rows: DailyQuestRow[]): string | null {
  const claimable = countClaimableDailyQuests(rows);
  if (claimable <= 0) return null;
  const firstId = pickFirstClaimableDailyQuestCfgId(rows);
  if (firstId > 0) return `日常可领 ${claimable} · #${firstId}`;
  return `日常可领 ${claimable}`;
}

/** 邮件未读/未领与日常首条可领合并为 HUD 底栏一行。 */
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
  const unread = Math.max(0, mailCounts.unreadForTab);
  const unclaimed = Math.max(0, mailCounts.unclaimedCount);
  const mailParts: string[] = [];
  if (unread > 0) mailParts.push(`未读 ${unread}`);
  if (unclaimed > 0) mailParts.push(`未领附件 ${unclaimed}`);
  const mailLine = mailParts.length ? mailParts.join(" · ") : null;
  const questClaimHud = formatQuestClaimHudLinkLine(dailyRows);
  return formatMailDailyHudCombinedSweepLine({ mailTabSweep: mailLine, questClaimHud });
}
