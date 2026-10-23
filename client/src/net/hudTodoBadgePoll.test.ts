import { describe, expect, it, vi } from "vitest";
import { BattleReportUnreadSession } from "@/net/battleReportUnread";
import { HudTodoBadgePoll } from "@/net/hudTodoBadgePoll";

describe("HudTodoBadgePoll", () => {
  it("single-flights mail list and respects suppression", async () => {
    const listPlayerMail = vi.fn().mockResolvedValue({ total_count: 7 });
    const listPlayerQuests = vi.fn().mockResolvedValue({ quests: [] });
    const listBattleReports = vi.fn().mockResolvedValue({ reports: [] });
    const gateway = { listPlayerMail, listPlayerQuests, listBattleReports };
    const unread = new BattleReportUnreadSession();
    let counts = { mailUnread: -1, dailyTodo: -1, battleReportUnread: -1 };
    const poll = new HudTodoBadgePoll({
      gateway: gateway as never,
      getServerId: () => 1,
      getCityId: () => 9,
      battleReportUnread: unread,
      isPanelVisible: () => false,
      isMailSuppressed: () => true,
      isDailySuppressed: () => false,
      isReportsSuppressed: () => false,
      onCounts: (c) => {
        counts = c;
      },
      fastIntervalSec: 0.01,
      slowIntervalSec: 0.01,
    });
    poll.tick(1);
    await vi.waitFor(() => expect(counts.mailUnread).toBe(0));
    expect(listPlayerMail).not.toHaveBeenCalled();

    const poll2 = new HudTodoBadgePoll({
      gateway: gateway as never,
      getServerId: () => 1,
      getCityId: () => 9,
      battleReportUnread: unread,
      isPanelVisible: () => false,
      isMailSuppressed: () => false,
      isDailySuppressed: () => false,
      isReportsSuppressed: () => false,
      onCounts: (c) => {
        counts = c;
      },
      fastIntervalSec: 0.01,
      slowIntervalSec: 0.01,
    });
    void poll2.pollOnce();
    void poll2.pollOnce();
    await vi.waitFor(() => expect(counts.mailUnread).toBe(7));
    expect(listPlayerMail).toHaveBeenCalledTimes(1);
  });

  it("stores deep-link snapshot ids from poll responses", async () => {
    const listPlayerMail = vi.fn().mockResolvedValue({
      total_count: 2,
      mails: [{ mail_id: 88, status: 0 }],
    });
    const listPlayerQuests = vi.fn().mockResolvedValue({
      quests: [
        { quest_cfg_id: 100, state: 2 },
        { quest_cfg_id: 101, state: 3 },
      ],
    });
    const listBattleReports = vi.fn().mockResolvedValue({
      reports: [{ report_id: 5, outcome: 1, created_at_ms: 0 }],
    });
    const gateway = { listPlayerMail, listPlayerQuests, listBattleReports };
    const unread = new BattleReportUnreadSession();
    const poll = new HudTodoBadgePoll({
      gateway: gateway as never,
      getServerId: () => 1,
      getCityId: () => 9,
      battleReportUnread: unread,
      isPanelVisible: () => false,
      isMailSuppressed: () => false,
      isDailySuppressed: () => false,
      isReportsSuppressed: () => false,
      onCounts: () => {},
    });
    await poll.pollOnce();
    const snap = poll.getDeepLinkSnapshot();
    expect(snap.firstUnreadMailId).toBe(88);
    expect(snap.firstDailyTodoCfgId).toBe(101);
    expect(snap.firstUnreadBattleReportId).toBe(5);
    expect(snap.mailUnread).toBe(2);
    expect(snap.dailyTodo).toBe(1);
    expect(snap.battleReportUnread).toBe(1);
  });

  it("applyMailUnreadSnapshot patches deep link while mail panel suppressed", async () => {
    const gateway = {
      listPlayerMail: vi.fn(),
      listPlayerQuests: vi.fn().mockResolvedValue({ quests: [] }),
      listBattleReports: vi.fn().mockResolvedValue({ reports: [] }),
    };
    const unread = new BattleReportUnreadSession();
    let counts = { mailUnread: 9, dailyTodo: 0, battleReportUnread: 0 };
    const poll = new HudTodoBadgePoll({
      gateway: gateway as never,
      getServerId: () => 1,
      getCityId: () => 9,
      battleReportUnread: unread,
      isPanelVisible: () => false,
      isMailSuppressed: () => true,
      isDailySuppressed: () => false,
      isReportsSuppressed: () => false,
      onCounts: (c) => {
        counts = c;
      },
    });
    poll.applyMailUnreadSnapshot(2, 77);
    expect(poll.getDeepLinkSnapshot().mailUnread).toBe(2);
    expect(poll.getDeepLinkSnapshot().firstUnreadMailId).toBe(77);
    expect(counts.mailUnread).toBe(9);
    poll.applyMailUnreadSnapshot(1, 0);
    expect(poll.getDeepLinkSnapshot().mailUnread).toBe(1);
  });
});
