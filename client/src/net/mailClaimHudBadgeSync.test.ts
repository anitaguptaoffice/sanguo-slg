import { describe, expect, it, vi } from "vitest";
import { DAILY_QUEST_STATE_CLAIMABLE } from "@/net/hudTodoBadge";
import {
  MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS,
  MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_MS,
  MAIL_CLAIM_HUD_SYNC_PULSE_CLASS,
  MAIL_CLAIM_HUD_SYNC_PULSE_MS,
  MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_CLASS,
  MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_MS,
  pulseMailClaimHudSyncAfterClaimDeep,
  pulseMailClaimHudSyncAfterClaimResidualDeep,
  scheduleMailClaimHudSyncDeepPulse,
  scheduleMailClaimHudSyncPulse,
  scheduleMailClaimHudSyncResidualDeepPulse,
  syncHudMailQuestBadgeAfterClaim,
  syncHudMailQuestBadgeAfterClaimDeep,
  syncHudMailQuestBadgeAfterClaimResidualDeep,
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
      "all",
    );
    expect(after.unclaimedTab).toBe(1);
    expect(after.mailClaimable).toBe(1);
    expect(after.dailyClaimable).toBe(1);
    expect(after.toolbarDaily).toBe(1);
    expect(after.hudTodoSweepLine).toContain("日常可领 1");
    expect(after.mailCombinedSweepLine).toContain("日常可领 1 · #88");
  });

  it("updates inbox snapshot row to claimed", () => {
    const rowAfter = { ...inbox[1], mail_id: 2, status: 2, has_unclaimed_attachments: false };
    const res = syncHudMailQuestBadgeAfterClaim(
      { mailUnreadTotal: 0, mailInboxSnapshot: inbox, dailyChainRows: [] },
      2,
      rowAfter,
      "unclaimed",
    );
    const row = res.mailInboxSnapshot.find((m) => m.mail_id === 2);
    expect(row?.has_unclaimed_attachments).toBe(false);
    expect(res.mailTabUnreadSweepLine).toBe("未领附件 1");
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
});

describe("syncHudMailQuestBadgeAfterClaimDeep (CLIENT-255)", () => {
  it("extends CLIENT-241 sync with attachment claim residual subline", () => {
    const inbox = [
      {
        mail_id: 5,
        status: 1,
        attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
      },
    ];
    const deep = syncHudMailQuestBadgeAfterClaimDeep(
      { mailUnreadTotal: 0, mailInboxSnapshot: inbox, dailyChainRows: [] },
      5,
      { ...inbox[0], mail_id: 5, status: 2, has_unclaimed_attachments: false },
      "all",
      { items: [{ item_cfg_id: 2001, quantity: 1 }] },
      inbox[0],
    );
    expect(deep.unclaimedTab).toBe(0);
    expect(deep.attachmentClaimResidualSubline).toContain("附件残余");
    expect(deep.attachmentClaimResidualSubline).toContain("已领");
  });
});

describe("mail-claim-hud-sync-deep-pulse (CLIENT-255)", () => {
  it("scheduleMailClaimHudSyncDeepPulse toggles class for 2.5s", () => {
    vi.useFakeTimers();
    const li = document.createElement("li");
    scheduleMailClaimHudSyncDeepPulse(li);
    expect(li.classList.contains(MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_MS - 1);
    expect(li.classList.contains(MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(li.classList.contains(MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS)).toBe(false);
    vi.useRealTimers();
  });

  it("pulseMailClaimHudSyncAfterClaimDeep stacks CLIENT-241 and deep pulse classes", () => {
    const li = document.createElement("li");
    pulseMailClaimHudSyncAfterClaimDeep(li);
    expect(li.classList.contains(MAIL_CLAIM_HUD_SYNC_PULSE_CLASS)).toBe(true);
    expect(li.classList.contains(MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS)).toBe(true);
  });
});

describe("syncHudMailQuestBadgeAfterClaimResidualDeep (CLIENT-271)", () => {
  it("extends CLIENT-255 sync with attachment claim residual deep subline", () => {
    const inbox = [
      {
        mail_id: 6,
        status: 1,
        attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
      },
    ];
    const res = syncHudMailQuestBadgeAfterClaimResidualDeep(
      { mailUnreadTotal: 0, mailInboxSnapshot: inbox, dailyChainRows: [] },
      6,
      { ...inbox[0], mail_id: 6, status: 2, has_unclaimed_attachments: false },
      "all",
      { items: [{ item_cfg_id: 2001, quantity: 1 }] },
      inbox[0],
    );
    expect(res.unclaimedTab).toBe(0);
    expect(res.attachmentClaimResidualSubline).toContain("附件残余");
    expect(res.attachmentClaimResidualDeepSubline).toContain("附件残余加深");
    expect(res.attachmentClaimResidualDeepSubline).toContain("↔");
  });
});

describe("mail-claim-hud-sync-residual-deep-pulse (CLIENT-271)", () => {
  it("scheduleMailClaimHudSyncResidualDeepPulse toggles class for 3s", () => {
    vi.useFakeTimers();
    const li = document.createElement("li");
    scheduleMailClaimHudSyncResidualDeepPulse(li);
    expect(li.classList.contains(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_MS - 1);
    expect(li.classList.contains(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_CLASS)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(li.classList.contains(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_CLASS)).toBe(false);
    vi.useRealTimers();
  });

  it("pulseMailClaimHudSyncAfterClaimResidualDeep stacks CLIENT-255 and residual deep pulse", () => {
    const li = document.createElement("li");
    pulseMailClaimHudSyncAfterClaimResidualDeep(li);
    expect(li.classList.contains(MAIL_CLAIM_HUD_SYNC_PULSE_CLASS)).toBe(true);
    expect(li.classList.contains(MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS)).toBe(true);
    expect(li.classList.contains(MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_CLASS)).toBe(true);
  });
});
