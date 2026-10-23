import { describe, expect, it } from "vitest";
import {
  buildHudTodoBadges,
  countMailUnreadAndUnclaimed,
  dailyToolbarBadgeCount,
  mailToolbarBadgeCount,
  queueBuildingToolbarBadgeCount,
} from "@/net/hudTodoBadges";

describe("hudTodoBadges", () => {
  const now = 1_700_000_000_000;

  it("countMailUnreadAndUnclaimed dedupes unread with unclaimed", () => {
    expect(
      countMailUnreadAndUnclaimed([
        { mail_id: 1, status: 0 },
        { mail_id: 2, status: 2, has_unclaimed_attachments: true },
        { mail_id: 3, status: 0, has_unclaimed_attachments: true },
      ]),
    ).toBe(3);
  });

  it("mailToolbarBadgeCount adds read-unclaimed on top of unread total", () => {
    expect(
      mailToolbarBadgeCount({
        unreadTotal: 2,
        mailClaimablePage: [
          { mail_id: 1, status: 0 },
          { mail_id: 2, status: 2, has_unclaimed_attachments: true },
        ],
      }),
    ).toBe(3);
  });

  it("mailToolbarBadgeCount empty inbox is 0 without error", () => {
    expect(mailToolbarBadgeCount({ unreadTotal: 0, mailClaimablePage: [] })).toBe(0);
  });

  it("dailyToolbarBadgeCount counts claimable only (CLIENT-091)", () => {
    expect(
      dailyToolbarBadgeCount([
        { quest_cfg_id: 1, state: 1 },
        { quest_cfg_id: 2, state: 3 },
        { quest_cfg_id: 3, state: 2 },
      ]),
    ).toBe(1);
  });

  it("queueBuildingToolbarBadgeCount counts in-progress upgrades", () => {
    expect(
      queueBuildingToolbarBadgeCount(
        [
          { slot_key: "farm", level: 1, upgrade_finish_at_ms: now + 60_000 },
          { slot_key: "hall", level: 2, upgrade_finish_at_ms: now - 1 },
        ],
        now,
      ),
    ).toBe(1);
  });

  it("buildHudTodoBadges aligns toolbar mail with center claimable sources", () => {
    const bundle = buildHudTodoBadges({
      mailUnreadTotal: 1,
      mailClaimablePage: [
        { mail_id: 10, status: 0 },
        { mail_id: 11, status: 2, has_unclaimed_attachments: true },
      ],
      dailyRows: [{ quest_cfg_id: 100, state: 3 }],
      buildings: [{ slot_key: "farm", level: 1, upgrade_finish_at_ms: now + 120_000 }],
      buildCompleteCount: 1,
      battleReportUnread: 2,
      nowMs: now,
    });
    expect(bundle.toolbar.mail).toBe(2);
    expect(bundle.toolbar.daily).toBe(1);
    expect(bundle.toolbar.queue).toBe(1);
    expect(bundle.toolbar.reports).toBe(2);
    expect(bundle.center).toEqual({ mailClaimable: 1, dailyClaimable: 1, buildComplete: 1 });
  });
});
