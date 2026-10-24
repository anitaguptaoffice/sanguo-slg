import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAIL_TAB_HUD_SYNC_PULSE_CLASS,
  MAIL_TAB_HUD_SYNC_PULSE_MS,
  formatMailTabUnreadSweepLine,
  mailInboxFilterToUnreadSweepTab,
  scheduleMailTabHudSyncPulse,
  setHudCenterPanelDeepLinkRefreshStamp,
} from "@/net/mailTabUnreadSweep";
import { HUD_CENTER_PANEL_DEEPLINK_REFRESH_STAMP_ATTR } from "@/net/hudCenterPanelDeepLink";
import {
  MAIL_INBOX_FILTER_ALL,
  MAIL_INBOX_FILTER_UNCLAIMED,
  MAIL_INBOX_FILTER_UNREAD,
} from "@/net/heroMailState";

describe("formatMailTabUnreadSweepLine (CLIENT-209)", () => {
  it("formats per-tab unread and unclaimed counts", () => {
    const counts = { unreadForTab: 3, unclaimedCount: 2 };
    expect(formatMailTabUnreadSweepLine("all", counts)).toBe("未读 3 · 未领附件 2");
    expect(formatMailTabUnreadSweepLine("unread", counts)).toBe("未读 3");
    expect(formatMailTabUnreadSweepLine("unclaimed", counts)).toBe("未领附件 2");
    expect(formatMailTabUnreadSweepLine("unread", { unreadForTab: 0, unclaimedCount: 1 })).toBeNull();
  });

  it("maps inbox filter to sweep tab", () => {
    expect(mailInboxFilterToUnreadSweepTab(MAIL_INBOX_FILTER_ALL)).toBe("all");
    expect(mailInboxFilterToUnreadSweepTab(MAIL_INBOX_FILTER_UNREAD)).toBe("unread");
    expect(mailInboxFilterToUnreadSweepTab(MAIL_INBOX_FILTER_UNCLAIMED)).toBe("unclaimed");
  });
});

describe("mail-tab-hud-sync-pulse (CLIENT-209)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it(`applies ${MAIL_TAB_HUD_SYNC_PULSE_CLASS} for ${MAIL_TAB_HUD_SYNC_PULSE_MS}ms`, () => {
    vi.useFakeTimers();
    const el = document.createElement("p");
    scheduleMailTabHudSyncPulse(el);
    expect(el.classList.contains(MAIL_TAB_HUD_SYNC_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(MAIL_TAB_HUD_SYNC_PULSE_MS);
    expect(el.classList.contains(MAIL_TAB_HUD_SYNC_PULSE_CLASS)).toBe(false);
  });

  it("sets HUD deep link refresh stamp attr on mail sweep nodes", () => {
    const el = document.createElement("p");
    setHudCenterPanelDeepLinkRefreshStamp(el, 1700000000123);
    expect(el.getAttribute(HUD_CENTER_PANEL_DEEPLINK_REFRESH_STAMP_ATTR)).toBe("1700000000123");
  });
});
