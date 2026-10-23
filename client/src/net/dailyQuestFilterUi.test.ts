import { describe, expect, it } from "vitest";
import {
  dailyQuestClaimableBadgeCount,
  dailyQuestClaimableBadgeCountMatchesHud,
  formatDailyQuestClaimableFilterBadge,
  shouldShowDailyQuestClaimableFilterBadge,
} from "@/net/dailyQuestFilterUi";
import type { DailyQuestRow } from "@/net/dailyQuestState";
import { buildHudTodoBadges } from "@/net/hudTodoBadges";

const rows: DailyQuestRow[] = [
  { quest_cfg_id: 1, state: 2 },
  { quest_cfg_id: 2, state: 3 },
  { quest_cfg_id: 3, state: 3 },
  { quest_cfg_id: 4, state: 4 },
];

describe("dailyQuestFilterUi (CLIENT-123)", () => {
  it("claimable count matches HUD toolbar daily (CLIENT-107)", () => {
    const count = dailyQuestClaimableBadgeCount(rows);
    const hud = buildHudTodoBadges({
      mailUnreadTotal: 0,
      mailClaimablePage: [],
      dailyRows: rows,
      buildCompleteCount: 0,
      battleReportUnread: 0,
    });
    expect(dailyQuestClaimableBadgeCountMatchesHud(rows, hud.toolbar.daily)).toBe(true);
    expect(count).toBe(2);
  });

  it("formatDailyQuestClaimableFilterBadge uses 1–9 / 9+ and hides at 0", () => {
    expect(formatDailyQuestClaimableFilterBadge([])).toBe("");
    expect(shouldShowDailyQuestClaimableFilterBadge([])).toBe(false);
    expect(formatDailyQuestClaimableFilterBadge(rows)).toBe("2");
    expect(shouldShowDailyQuestClaimableFilterBadge(rows)).toBe(true);
    const many = Array.from({ length: 12 }, (_, i) => ({
      quest_cfg_id: i + 1,
      state: 3 as const,
    }));
    expect(formatDailyQuestClaimableFilterBadge(many)).toBe("9+");
  });
});
