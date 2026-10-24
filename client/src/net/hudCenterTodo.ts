import type { DailyQuestRow } from "@/net/dailyQuestState";
import type { MailRow } from "@/net/heroMailState";
import { mailHasUnclaimedAttachments } from "@/net/heroMailState";
import { formatBadgeCount } from "@/engine/artBadgeSkin";
import { DAILY_QUEST_STATE_CLAIMABLE } from "@/net/hudTodoBadge";
import { formatHudTodoSweepLine } from "@/net/hudTodoSweep";

/**
 * CLIENT-077 顶栏待办聚合（中心面板邮件 / 日常 / 队列），与底栏 CLIENT-027·038 角标并存。
 *
 * 计数规则（展示为三类之和，0 隐藏角标）：
 * - 可领取邮件：收件箱列表顺序下 `mailHasUnclaimedAttachments` 为 true 的邮件条数（与未读角标独立）。
 * - 可领日常：chain 400 中 state === 可领奖(3) 的条数（不含可接取 1；底栏日常角标仍计 1+3）。
 * - 建造完成：`BuildCompleteTodoTracker` 记录的槽位完成待确认条数（来自 GetCityState 建造队列状态变迁，无额外 RPC）。
 *
 * 深链优先级（打开对应中心面板并滚到首条）：可领日常 → 可领取邮件 → 建造完成。
 */

export type HudCenterTodoCounts = {
  mailClaimable: number;
  dailyClaimable: number;
  buildComplete: number;
};

export type HudCenterTodoPanel = "mail" | "daily" | "queue";

export type HudCenterTodoTarget = {
  panel: HudCenterTodoPanel;
  scrollTargetId: string;
  mailId?: number;
  questCfgId?: number;
  slotKey?: string;
};

export const HUD_CENTER_TODO_PRIORITY: HudCenterTodoPanel[] = ["daily", "mail", "queue"];

export function sumHudCenterTodoCounts(counts: HudCenterTodoCounts): number {
  return Math.max(0, counts.mailClaimable) + Math.max(0, counts.dailyClaimable) + Math.max(0, counts.buildComplete);
}

export function formatHudCenterTodoBadge(counts: HudCenterTodoCounts): string {
  return formatBadgeCount(sumHudCenterTodoCounts(counts));
}

export function countClaimableDailyQuests(rows: DailyQuestRow[]): number {
  let n = 0;
  for (const q of rows) {
    if ((q.state ?? 0) === DAILY_QUEST_STATE_CLAIMABLE) n++;
  }
  return n;
}

export function pickFirstClaimableDailyQuestCfgId(rows: DailyQuestRow[]): number {
  for (const q of rows) {
    if ((q.state ?? 0) !== DAILY_QUEST_STATE_CLAIMABLE) continue;
    const id = q.quest_cfg_id ?? 0;
    if (id > 0) return id;
  }
  return 0;
}

export function pickFirstClaimableMailId(mails: MailRow[]): number {
  for (const m of mails) {
    const id = m.mail_id ?? 0;
    if (id > 0 && mailHasUnclaimedAttachments(m)) return id;
  }
  return 0;
}

export function countClaimableMails(mails: MailRow[]): number {
  return mails.filter(mailHasUnclaimedAttachments).length;
}

export function centerTodoScrollTargetId(panel: HudCenterTodoPanel, id: string | number): string {
  return `${panel}:${id}`;
}

export function pickHudCenterTodoTarget(input: {
  counts: HudCenterTodoCounts;
  firstClaimableMailId: number;
  firstClaimableDailyCfgId: number;
  firstBuildCompleteSlotKey: string;
}): HudCenterTodoTarget | null {
  const { counts, firstClaimableMailId, firstClaimableDailyCfgId, firstBuildCompleteSlotKey } = input;
  if (counts.dailyClaimable > 0 && firstClaimableDailyCfgId > 0) {
    return {
      panel: "daily",
      scrollTargetId: centerTodoScrollTargetId("daily", firstClaimableDailyCfgId),
      questCfgId: firstClaimableDailyCfgId,
    };
  }
  if (counts.mailClaimable > 0 && firstClaimableMailId > 0) {
    return {
      panel: "mail",
      scrollTargetId: centerTodoScrollTargetId("mail", firstClaimableMailId),
      mailId: firstClaimableMailId,
    };
  }
  if (counts.buildComplete > 0 && firstBuildCompleteSlotKey) {
    return {
      panel: "queue",
      scrollTargetId: centerTodoScrollTargetId("queue", firstBuildCompleteSlotKey),
      slotKey: firstBuildCompleteSlotKey,
    };
  }
  return null;
}

/** 同一 scroll target 且面板已打开时，重复点击顶栏角标不再 scrollIntoView。 */
export function shouldSkipRepeatCenterTodoScroll(
  lastScrollKey: string | null,
  nextTarget: HudCenterTodoTarget,
  panelWasOpen: boolean,
): boolean {
  return panelWasOpen && lastScrollKey === nextTarget.scrollTargetId;
}

export function hudCenterTodoTitle(counts: HudCenterTodoCounts): string {
  const parts: string[] = [];
  const sweep = formatHudTodoSweepLine({
    mailClaimable: counts.mailClaimable,
    dailyClaimable: counts.dailyClaimable,
  });
  if (sweep) parts.push(sweep);
  if (counts.buildComplete > 0) parts.push(`建造完成 ${counts.buildComplete}`);
  return parts.length ? `待办 · ${parts.join(" · ")}` : "暂无待办";
}
