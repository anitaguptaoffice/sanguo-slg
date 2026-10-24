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
    let counts = { mailUnread: -1, dailyTodo: -1, queueBuilding: -1, battleReportUnread: -1 };
    const poll = new HudTodoBadgePoll({
      gateway: gateway as never,
      getServerId: () => 1,
      getCityId: () => 9,
      getBuildings: () => [],
      getBuildCompleteCount: () => 0,
      battleReportUnread: unread,
      isPanelVisible: () => false,
      isMailSuppressed: () => true,
      isDailySuppressed: () => false,
      isReportsSuppressed: () => false,
      isQueueSuppressed: () => false,
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
      getBuildings: () => [],
      getBuildCompleteCount: () => 0,
      battleReportUnread: unread,
      isPanelVisible: () => false,
      isMailSuppressed: () => false,
      isDailySuppressed: () => false,
      isReportsSuppressed: () => false,
      isQueueSuppressed: () => false,
      onCounts: (c) => {
        counts = c;
      },
      fastIntervalSec: 0.01,
      slowIntervalSec: 0.01,
    });
    void poll2.pollOnce();
    void poll2.pollOnce();
    await vi.waitFor(() => expect(counts.mailUnread).toBe(7));
    expect(listPlayerMail).toHaveBeenCalledTimes(2);
    expect(counts.queueBuilding).toBe(0);
  });

  it("coalesces concurrent pollOnce (CLIENT-162 batch refresh)", async () => {
    const listPlayerMail = vi.fn().mockResolvedValue({ total_count: 1, mails: [] });
    const gateway = {
      listPlayerMail,
      listPlayerQuests: vi.fn().mockResolvedValue({ quests: [] }),
      listBattleReports: vi.fn().mockResolvedValue({ reports: [] }),
    };
    const unread = new BattleReportUnreadSession();
    const poll = new HudTodoBadgePoll({
      gateway: gateway as never,
      getServerId: () => 1,
      getCityId: () => 9,
      getBuildings: () => [],
      getBuildCompleteCount: () => 0,
      battleReportUnread: unread,
      isPanelVisible: () => false,
      isMailSuppressed: () => false,
      isDailySuppressed: () => false,
      isReportsSuppressed: () => false,
      isQueueSuppressed: () => false,
      onCounts: () => {},
    });
    const first = poll.pollOnce();
    const second = poll.pollOnce();
    expect(first).toBe(second);
    await first;
    expect(listPlayerMail).toHaveBeenCalledTimes(2);
  });

  it("stores deep-link snapshot ids from poll responses", async () => {
    const listPlayerMail = vi.fn().mockImplementation((_sid: number, opts: { filter?: number }) => {
      if (opts?.filter === 1) {
        return Promise.resolve({
          total_count: 2,
          mails: [{ mail_id: 88, status: 0 }],
        });
      }
      return Promise.resolve({
        mails: [
          { mail_id: 88, status: 0 },
          { mail_id: 90, status: 2, has_unclaimed_attachments: true },
        ],
      });
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
      getBuildings: () => [],
      getBuildCompleteCount: () => 0,
      battleReportUnread: unread,
      isPanelVisible: () => false,
      isMailSuppressed: () => false,
      isDailySuppressed: () => false,
      isReportsSuppressed: () => false,
      isQueueSuppressed: () => false,
      onCounts: () => {},
    });
    await poll.pollOnce();
    const snap = poll.getDeepLinkSnapshot();
    expect(snap.firstUnreadMailId).toBe(88);
    expect(snap.firstDailyTodoCfgId).toBe(101);
    expect(snap.firstUnreadBattleReportId).toBe(5);
    expect(snap.mailUnread).toBe(3);
    expect(snap.mailUnreadTotal).toBe(2);
    expect(snap.dailyTodo).toBe(1);
    expect(snap.battleReportUnread).toBe(1);
    expect(snap.dailyChainRows).toHaveLength(2);
    expect(snap.dailyChainRows[0]?.quest_cfg_id).toBe(100);
    expect(snap.mailClaimable).toBe(1);
    expect(snap.firstClaimableMailId).toBe(90);
    expect(snap.dailyClaimable).toBe(1);
    expect(snap.firstClaimableDailyCfgId).toBe(101);
  });

  it("applyDailyChainRowsSnapshot updates claimable toolbar count (CLIENT-150)", async () => {
    const gateway = {
      listPlayerMail: vi.fn(),
      listPlayerQuests: vi.fn(),
      listBattleReports: vi.fn(),
    };
    const unread = new BattleReportUnreadSession();
    let counts = { mailUnread: 0, dailyTodo: 2, queueBuilding: 0, battleReportUnread: 0 };
    const poll = new HudTodoBadgePoll({
      gateway: gateway as never,
      getServerId: () => 1,
      getCityId: () => 9,
      getBuildings: () => [],
      getBuildCompleteCount: () => 0,
      battleReportUnread: unread,
      isPanelVisible: () => false,
      isMailSuppressed: () => false,
      isDailySuppressed: () => false,
      isReportsSuppressed: () => false,
      isQueueSuppressed: () => false,
      onCounts: (c) => {
        counts = c;
      },
    });
    poll.applyDailyChainRowsSnapshot([
      { quest_cfg_id: 1012, state: 3 },
      { quest_cfg_id: 1013, state: 3 },
    ]);
    expect(counts.dailyTodo).toBe(2);
    poll.applyDailyChainRowsSnapshot([{ quest_cfg_id: 1012, state: 4 }]);
    expect(counts.dailyTodo).toBe(0);
    expect(poll.getDeepLinkSnapshot().dailyClaimable).toBe(0);
  });

  it("applyMailInboxSnapshot updates claimable deep link and toolbar mail count", async () => {
    const gateway = {
      listPlayerMail: vi.fn(),
      listPlayerQuests: vi.fn(),
      listBattleReports: vi.fn(),
    };
    const unread = new BattleReportUnreadSession();
    let counts = { mailUnread: 0, dailyTodo: 0, queueBuilding: 0, battleReportUnread: 0 };
    const poll = new HudTodoBadgePoll({
      gateway: gateway as never,
      getServerId: () => 1,
      getCityId: () => 9,
      getBuildings: () => [],
      getBuildCompleteCount: () => 0,
      battleReportUnread: unread,
      isPanelVisible: () => false,
      isMailSuppressed: () => false,
      isDailySuppressed: () => false,
      isReportsSuppressed: () => false,
      isQueueSuppressed: () => false,
      onCounts: (c) => {
        counts = c;
      },
    });
    poll.applyMailInboxSnapshot(
      [
        { mail_id: 1, status: 0, attachments: { items: [{ item_cfg_id: 1, quantity: 1 }] } },
        { mail_id: 2, status: 2, has_unclaimed_attachments: true },
      ],
      2,
    );
    expect(counts.mailUnread).toBe(3);
    expect(poll.getDeepLinkSnapshot().mailClaimable).toBe(2);
    poll.applyMailInboxSnapshot([{ mail_id: 2, status: 2, has_unclaimed_attachments: true }], 1);
    expect(counts.mailUnread).toBe(2);
    expect(poll.getDeepLinkSnapshot().mailClaimable).toBe(1);
  });

  it("applyMailUnreadSnapshot patches deep link while mail panel suppressed", async () => {
    const gateway = {
      listPlayerMail: vi.fn(),
      listPlayerQuests: vi.fn().mockResolvedValue({ quests: [] }),
      listBattleReports: vi.fn().mockResolvedValue({ reports: [] }),
    };
    const unread = new BattleReportUnreadSession();
    let counts = { mailUnread: 9, dailyTodo: 0, queueBuilding: 0, battleReportUnread: 0 };
    let onCountsCalls = 0;
    const poll = new HudTodoBadgePoll({
      gateway: gateway as never,
      getServerId: () => 1,
      getCityId: () => 9,
      getBuildings: () => [],
      getBuildCompleteCount: () => 0,
      battleReportUnread: unread,
      isPanelVisible: () => false,
      isMailSuppressed: () => true,
      isDailySuppressed: () => false,
      isReportsSuppressed: () => false,
      isQueueSuppressed: () => false,
      onCounts: (c) => {
        counts = c;
        onCountsCalls += 1;
      },
    });
    poll.applyMailUnreadSnapshot(2, 77);
    expect(onCountsCalls).toBe(0);
    expect(poll.getDeepLinkSnapshot().mailUnreadTotal).toBe(2);
    expect(poll.getDeepLinkSnapshot().mailUnread).toBe(2);
    expect(poll.getDeepLinkSnapshot().firstUnreadMailId).toBe(77);
    expect(counts.mailUnread).toBe(9);
    poll.applyMailUnreadSnapshot(1, 0);
    expect(poll.getDeepLinkSnapshot().mailUnread).toBe(1);
  });
});
