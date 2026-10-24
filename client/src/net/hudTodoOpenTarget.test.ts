import { describe, expect, it } from "vitest";
import { MAIL_INBOX_FILTER_ALL, MAIL_INBOX_FILTER_UNREAD } from "@/net/heroMailState";
import { EMPTY_HUD_TODO_DEEP_LINK, type HudTodoDeepLinkSnapshot } from "@/net/hudTodoBadge";
import {
  mailFilterTabCountsFromHudDeepLink,
  pickFirstQueueBuildingSlotKey,
  resolveHudTodoOpenTarget,
} from "@/net/hudTodoOpenTarget";

function snap(partial: Partial<HudTodoDeepLinkSnapshot>): HudTodoDeepLinkSnapshot {
  return { ...EMPTY_HUD_TODO_DEEP_LINK, ...partial };
}

describe("resolveHudTodoOpenTarget (CLIENT-134)", () => {
  it("mail badge prefers unread filter and CLIENT-122 tab counts", () => {
    const target = resolveHudTodoOpenTarget(
      "toggle-mail",
      snap({
        mailUnread: 2,
        mailUnreadTotal: 2,
        firstUnreadMailId: 9,
        mailClaimable: 1,
      }),
    );
    expect(target).toEqual({
      kind: "mail",
      mailId: 9,
      mailFilter: MAIL_INBOX_FILTER_UNREAD,
      unreadForTab: 2,
      unclaimedCount: 1,
    });
  });

  it("mail badge falls back to claimable on all filter when no unread total", () => {
    const target = resolveHudTodoOpenTarget(
      "toggle-mail",
      snap({
        mailUnread: 1,
        mailUnreadTotal: 0,
        mailClaimable: 1,
        firstClaimableMailId: 42,
      }),
    );
    expect(target).toMatchObject({
      kind: "mail",
      mailId: 42,
      mailFilter: MAIL_INBOX_FILTER_ALL,
      unclaimedCount: 1,
    });
  });

  it("daily badge uses claimable chip when dailyClaimable > 0", () => {
    const target = resolveHudTodoOpenTarget(
      "toggle-daily",
      snap({
        dailyTodo: 2,
        dailyClaimable: 2,
        firstClaimableDailyCfgId: 4003,
      }),
    );
    expect(target).toEqual({
      kind: "daily",
      cfgId: 4003,
      listFilter: "claimable",
      claimableCount: 2,
    });
  });

  it("queue badge highlights first in-progress build slot", () => {
    const now = 1_000_000;
    const target = resolveHudTodoOpenTarget(
      "toggle-queue",
      snap({
        queueBuilding: 1,
        firstQueueBuildingSlotKey: "farm",
      }),
      [
        { slot_key: "hall", upgrade_finish_at_ms: now + 60_000 },
        { slot_key: "farm", upgrade_finish_at_ms: now + 30_000 },
      ],
      now,
    );
    expect(target).toEqual({ kind: "queue-building", slotKey: "farm" });
  });

  it("returns none when toolbar badge count is zero", () => {
    expect(resolveHudTodoOpenTarget("toggle-mail", snap({ mailUnread: 0 }))).toEqual({
      kind: "none",
    });
    expect(resolveHudTodoOpenTarget("toggle-queue", snap({ queueBuilding: 0 }))).toEqual({
      kind: "none",
    });
  });

  it("battle-report deep link uses first unread id", () => {
    expect(
      resolveHudTodoOpenTarget(
        "toggle-reports",
        snap({ battleReportUnread: 1, firstUnreadBattleReportId: 77 }),
      ),
    ).toEqual({ kind: "battle-report", reportId: 77 });
  });
});

describe("pickFirstQueueBuildingSlotKey", () => {
  it("picks earliest finish_at slot", () => {
    const now = 5_000;
    expect(
      pickFirstQueueBuildingSlotKey(
        [
          { slot_key: "b", upgrade_finish_at_ms: now + 200 },
          { slot_key: "a", upgrade_finish_at_ms: now + 100 },
        ],
        now,
      ),
    ).toBe("a");
  });
});

describe("mailFilterTabCountsFromHudDeepLink", () => {
  it("matches HudTodoBadgePoll snapshot fields", () => {
    expect(
      mailFilterTabCountsFromHudDeepLink({ mailUnreadTotal: 3, mailClaimable: 2 }),
    ).toEqual({ unreadForTab: 3, unclaimedCount: 2 });
  });
});
