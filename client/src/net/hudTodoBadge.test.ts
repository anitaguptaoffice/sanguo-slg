import { describe, expect, it } from "vitest";
import {
  aggregateHudTodoCounts,
  countDailyTodoQuests,
  formatHudBadgeCount,
} from "@/net/hudTodoBadge";

describe("hudTodoBadge", () => {
  it("counts daily quests that are acceptable or claimable", () => {
    const n = countDailyTodoQuests([
      { quest_cfg_id: 1, state: 1 },
      { quest_cfg_id: 2, state: 2 },
      { quest_cfg_id: 3, state: 3 },
      { quest_cfg_id: 4, state: 4 },
    ]);
    expect(n).toBe(2);
  });

  it("formats badge counts with 99+ cap", () => {
    expect(formatHudBadgeCount(0)).toBe("");
    expect(formatHudBadgeCount(3)).toBe("3");
    expect(formatHudBadgeCount(100)).toBe("99+");
  });

  it("aggregates non-negative todo counts", () => {
    expect(
      aggregateHudTodoCounts({ mailUnread: 2, dailyTodo: -1, battleReportUnread: 5 }),
    ).toEqual({ mailUnread: 2, dailyTodo: 0, battleReportUnread: 5 });
  });
});
