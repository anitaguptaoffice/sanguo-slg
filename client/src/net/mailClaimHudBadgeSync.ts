import type { DailyQuestRow } from "@/net/dailyQuestState";
import { syncMailInboxSnapshotAfterClaim, type MailRow } from "@/net/heroMailState";
import { buildHudTodoBadges, mailHudBadgeFacetCounts, mailPanelTabBadgeCounts } from "@/net/hudTodoBadges";
import { formatHudTodoSweepLine } from "@/net/hudTodoSweep";
import {
  formatMailTabUnreadSweepLine,
  type MailTabUnreadSweepTab,
} from "@/net/mailTabUnreadSweep";
import { formatMailPanelHudCombinedSweepLine } from "@/net/questClaimHudLink";

/** CLIENT-241：领取成功后列表行 HUD 角标同步脉冲（与 CLIENT-192 `mail-claim-pulse` 并存）。 */
export const MAIL_CLAIM_HUD_SYNC_PULSE_CLASS = "mail-claim-hud-sync-pulse";
export const MAIL_CLAIM_HUD_SYNC_PULSE_MS = 2000;

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

export function scheduleMailClaimHudSyncPulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  row.classList.remove(MAIL_CLAIM_HUD_SYNC_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(MAIL_CLAIM_HUD_SYNC_PULSE_CLASS);
  window.setTimeout(() => {
    row.classList.remove(MAIL_CLAIM_HUD_SYNC_PULSE_CLASS);
  }, MAIL_CLAIM_HUD_SYNC_PULSE_MS);
}
