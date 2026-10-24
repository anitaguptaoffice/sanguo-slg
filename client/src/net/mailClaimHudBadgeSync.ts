import type { DailyQuestRow } from "@/net/dailyQuestState";
import { syncMailInboxSnapshotAfterClaim, type MailRow } from "@/net/heroMailState";
import { buildHudTodoBadges, mailHudBadgeFacetCounts, mailPanelTabBadgeCounts } from "@/net/hudTodoBadges";
import { formatHudTodoSweepLine } from "@/net/hudTodoSweep";
import type { MailClaimGrantedPayload } from "@/net/mailClaimFeedback";
import { formatMailAttachmentClaimResidualSubline } from "@/net/mailAttachmentClaimResidualSubline";
import {
  formatMailTabUnreadSweepLine,
  type MailTabUnreadSweepTab,
} from "@/net/mailTabUnreadSweep";
import { formatMailPanelHudCombinedSweepLine } from "@/net/questClaimHudLink";

/** CLIENT-241：领取成功后列表行 HUD 角标同步脉冲（与 CLIENT-192 `mail-claim-pulse` 并存）。 */
export const MAIL_CLAIM_HUD_SYNC_PULSE_CLASS = "mail-claim-hud-sync-pulse";
export const MAIL_CLAIM_HUD_SYNC_PULSE_MS = 2000;

/** CLIENT-255：CLIENT-241 同步基础上的残余深脉冲（2.5s；与 `mail-claim-hud-sync-pulse` 并存）。 */
export const MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS = "mail-claim-hud-sync-deep-pulse";
export const MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_MS = 2500;

export type HudMailQuestBadgeSyncInput = {
  mailUnreadTotal: number;
  mailInboxSnapshot: MailRow[];
  dailyChainRows: DailyQuestRow[];
};

/** 领取后 HUD 邮件 tab / 底栏角标与日常可领计数切面（CLIENT-050/106/209/193 同源推导）。 */
export type HudMailQuestBadgeSyncResult = HudMailQuestBadgeSyncInput & {
  toolbarMail: number;
  unreadTab: number;
  unclaimedTab: number;
  mailClaimable: number;
  dailyClaimable: number;
  toolbarDaily: number;
  hudTodoSweepLine: string | null;
  mailCombinedSweepLine: string | null;
  mailTabUnreadSweepLine: string | null;
};

/** CLIENT-255：在 CLIENT-241 同步结果上附带附件领取残余次行文案。 */
export type HudMailQuestBadgeDeepSyncResult = HudMailQuestBadgeSyncResult & {
  attachmentClaimResidualSubline: string | null;
};

/**
 * 邮件附件领取成功后刷新收件箱快照并推导 HUD 邮件未读/未领附件与日常可领计数（无新 RPC）。
 */
export function syncHudMailQuestBadgeAfterClaim(
  input: HudMailQuestBadgeSyncInput,
  mailId: number,
  rowAfter: MailRow,
  mailFilterTab: MailTabUnreadSweepTab = "all",
): HudMailQuestBadgeSyncResult {
  const mailInboxSnapshot = syncMailInboxSnapshotAfterClaim(
    input.mailInboxSnapshot,
    mailId,
    rowAfter,
  );
  const mailUnreadTotal = Math.max(0, input.mailUnreadTotal);
  const dailyChainRows = input.dailyChainRows ?? [];

  const facets = mailHudBadgeFacetCounts({
    mailUnreadTotal,
    mailInboxSnapshot,
  });
  const panelTabs = mailPanelTabBadgeCounts({
    mailUnreadTotal,
    mailClaimablePage: mailInboxSnapshot,
  });
  const bundle = buildHudTodoBadges({
    mailUnreadTotal,
    mailClaimablePage: mailInboxSnapshot,
    dailyRows: dailyChainRows,
    buildCompleteCount: 0,
    battleReportUnread: 0,
  });

  const mailCounts = {
    unreadForTab: panelTabs.unreadTab,
    unclaimedCount: panelTabs.unclaimedTab,
  };

  return {
    mailUnreadTotal,
    mailInboxSnapshot,
    dailyChainRows,
    toolbarMail: facets.toolbarMail,
    unreadTab: panelTabs.unreadTab,
    unclaimedTab: panelTabs.unclaimedTab,
    mailClaimable: bundle.center.mailClaimable,
    dailyClaimable: bundle.center.dailyClaimable,
    toolbarDaily: bundle.toolbar.daily,
    hudTodoSweepLine: formatHudTodoSweepLine({
      mailClaimable: bundle.center.mailClaimable,
      dailyClaimable: bundle.center.dailyClaimable,
    }),
    mailCombinedSweepLine: formatMailPanelHudCombinedSweepLine(mailCounts, dailyChainRows),
    mailTabUnreadSweepLine: formatMailTabUnreadSweepLine(mailFilterTab, mailCounts),
  };
}

/**
 * CLIENT-255：CLIENT-241 `syncHudMailQuestBadgeAfterClaim` + 附件类型/领取结果残余次行（无新 RPC）。
 */
export function syncHudMailQuestBadgeAfterClaimDeep(
  input: HudMailQuestBadgeSyncInput,
  mailId: number,
  rowAfter: MailRow,
  mailFilterTab: MailTabUnreadSweepTab = "all",
  granted?: MailClaimGrantedPayload,
  mailBeforeClaim?: MailRow,
): HudMailQuestBadgeDeepSyncResult {
  const base = syncHudMailQuestBadgeAfterClaim(input, mailId, rowAfter, mailFilterTab);
  const before =
    mailBeforeClaim ??
    input.mailInboxSnapshot.find((m) => m.mail_id === mailId) ??
    rowAfter;
  const attachmentClaimResidualSubline = formatMailAttachmentClaimResidualSubline(before, granted);
  return { ...base, attachmentClaimResidualSubline };
}

export function scheduleMailClaimHudSyncPulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  row.classList.remove(MAIL_CLAIM_HUD_SYNC_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(MAIL_CLAIM_HUD_SYNC_PULSE_CLASS);
  window.setTimeout(() => {
    row.classList.remove(MAIL_CLAIM_HUD_SYNC_PULSE_CLASS);
  }, MAIL_CLAIM_HUD_SYNC_PULSE_MS);
}

export function scheduleMailClaimHudSyncDeepPulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  row.classList.remove(MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS);
  window.setTimeout(() => {
    row.classList.remove(MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS);
  }, MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_MS);
}

/** CLIENT-255：CLIENT-241 列表脉冲 + 残余深脉冲（CLIENT-050/106/209 角标推导仍走 deep sync）。 */
export function pulseMailClaimHudSyncAfterClaimDeep(row: HTMLElement | null | undefined): void {
  scheduleMailClaimHudSyncPulse(row);
  scheduleMailClaimHudSyncDeepPulse(row);
}
