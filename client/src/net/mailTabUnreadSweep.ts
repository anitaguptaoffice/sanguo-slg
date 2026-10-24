import {
  CENTER_PANEL_TAB_PULSE_MS,
  HUD_CENTER_PANEL_DEEPLINK_REFRESH_STAMP_ATTR,
} from "@/net/hudCenterPanelDeepLink";
import {
  MAIL_INBOX_FILTER_ALL,
  MAIL_INBOX_FILTER_UNCLAIMED,
  MAIL_INBOX_FILTER_UNREAD,
} from "@/net/heroMailState";

/** CLIENT-209：邮件分 tab 未读/未领附件扫读行（与 HUD 深链同源刷新戳记）。 */
export const MAIL_TAB_UNREAD_SWEEP_ROLE = "mail-tab-unread-sweep";
export const MAIL_DAILY_HUD_COMBINED_SWEEP_ROLE = "mail-daily-hud-combined-sweep";

export const MAIL_TAB_HUD_SYNC_PULSE_CLASS = "mail-tab-hud-sync-pulse";
export const MAIL_TAB_HUD_SYNC_PULSE_MS = CENTER_PANEL_TAB_PULSE_MS;

export type MailTabUnreadSweepTab = "all" | "unread" | "unclaimed";

export type MailTabUnreadSweepCounts = {
  unreadForTab: number;
  unclaimedCount: number;
};

export function mailInboxFilterToUnreadSweepTab(filter: number): MailTabUnreadSweepTab {
  if (filter === MAIL_INBOX_FILTER_UNREAD) return "unread";
  if (filter === MAIL_INBOX_FILTER_UNCLAIMED) return "unclaimed";
  if (filter === MAIL_INBOX_FILTER_ALL) return "all";
  return "all";
}

/** 各 tab 只读未读/未领附件计数扫读（与 tab 角标同源 `mailPanelTabBadgeCounts` 数字）。 */
export function formatMailTabUnreadSweepLine(
  tab: MailTabUnreadSweepTab,
  counts: MailTabUnreadSweepCounts,
): string | null {
  const unread = Math.max(0, counts.unreadForTab);
  const unclaimed = Math.max(0, counts.unclaimedCount);
  switch (tab) {
    case "all": {
      const parts: string[] = [];
      if (unread > 0) parts.push(`未读 ${unread}`);
      if (unclaimed > 0) parts.push(`未领附件 ${unclaimed}`);
      return parts.length ? parts.join(" · ") : null;
    }
    case "unread":
      return unread > 0 ? `未读 ${unread}` : null;
    case "unclaimed":
      return unclaimed > 0 ? `未领附件 ${unclaimed}` : null;
    default:
      return null;
  }
}

export function setHudCenterPanelDeepLinkRefreshStamp(el: HTMLElement, stamp: number): void {
  el.setAttribute(HUD_CENTER_PANEL_DEEPLINK_REFRESH_STAMP_ATTR, String(stamp));
}

export function scheduleMailTabHudSyncPulse(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.classList.remove(MAIL_TAB_HUD_SYNC_PULSE_CLASS);
  void el.offsetWidth;
  el.classList.add(MAIL_TAB_HUD_SYNC_PULSE_CLASS);
  window.setTimeout(() => {
    el.classList.remove(MAIL_TAB_HUD_SYNC_PULSE_CLASS);
  }, MAIL_TAB_HUD_SYNC_PULSE_MS);
}
