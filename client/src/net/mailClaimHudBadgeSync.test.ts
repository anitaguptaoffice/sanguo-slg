import { describe, expect, it, vi } from "vitest";
import { DAILY_QUEST_STATE_CLAIMABLE } from "@/net/hudTodoBadge";
import {
  MAIL_CLAIM_HUD_SYNC_PULSE_CLASS,
  MAIL_CLAIM_HUD_SYNC_PULSE_MS,
  scheduleMailClaimHudSyncPulse,
  syncHudMailQuestBadgeAfterClaim,
} from "@/net/mailClaimHudBadgeSync";

describe("syncHudMailQuestBadgeAfterClaim (CLIENT-241)", () => {
  const inbox = [
    {
      mail_id: 1,
      status: 0,
      has_unclaimed_attachments: true,
      attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
    },
    {
      mail_id: 2,
      status: 1,
      has_unclaimed_attachments: true,
      attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
    },
  ];
  const dailyRows = [{ quest_cfg_id: 88, state: DAILY_QUEST_STATE_CLAIMABLE }];

  it("decrements mail unclaimed facets while preserving daily claimable", () => {
    const after = syncHudMailQuestBadgeAfterClaim(
      { mailUnreadTotal: 1, mailInboxSnapshot: inbox, dailyChainRows: dailyRows },
      1,
      { ...inbox[0], mail_id: 1, status: 2, has_unclaimed_attachments: false },
    );
    expect(after.unreadTab).toBe(1);
    expect(after.unclaimedTab).toBe(1);
    expect(after.mailClaimable).toBe(1);
    expect(after.dailyClaimable).toBe(1);
    expect(after.toolbarDaily).toBe(1);
  });

  it("updates inbox snapshot row to claimed", () => {
    const rowAfter = { ...inbox[1], mail_id: 2, status: 2, has_unclaimed_attachments: false };
    const res = syncHudMailQuestBadgeAfterClaim(
      { mailUnreadTotal: 0, mailInboxSnapshot: inbox, dailyChainRows: [] },
      2,
      rowAfter,
    );
    const row = res.mailInboxSnapshot.find((m) => m.mail_id === 2);
    expect(row?.has_unclaimed_attachments).toBe(false);
    expect(row?.status).toBe(2);
    // 邮件 1 仍未领取附件，计数不回退。
    expect(res.unclaimedTab).toBe(1);
  });
});

describe("mail-claim-hud-sync-pulse (CLIENT-241)", () => {
  it("scheduleMailClaimHudSyncPulse toggles class for 2s", () => {
    vi.useFakeTimers();
    const li = document.createElement("li");
    scheduleMailClaimHudSyncPulse(li);
    expect(li.classList.contains(MAIL_CLAIM_HUD_SYNC_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(MAIL_CLAIM_HUD_SYNC_PULSE_MS - 1);
    expect(li.classList.contains(MAIL_CLAIM_HUD_SYNC_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(li.classList.contains(MAIL_CLAIM_HUD_SYNC_PULSE_CLASS)).toBe(false);
    vi.useRealTimers();
  });

  it("scheduleMailClaimHudSyncPulse ignores a missing row", () => {
    expect(() => scheduleMailClaimHudSyncPulse(null)).not.toThrow();
  });
});
