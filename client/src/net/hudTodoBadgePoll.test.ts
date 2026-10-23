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
});
