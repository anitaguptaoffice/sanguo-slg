import { describe, expect, it } from "vitest";
import {
  formatDailyQuestProgressSecondary,
  formatDailyQuestRowPrimary,
} from "@/net/dailyQuestProgressFormat";

describe("dailyQuestProgressFormat", () => {
  it("formatDailyQuestRowPrimary omits inline progress (CLIENT-150)", () => {
    const line = formatDailyQuestRowPrimary({
      quest_cfg_id: 1012,
      quest_code: "daily_food_1",
      state: 2,
      progress_current: 1200,
      progress_target: 5000,
    });
    expect(line).toContain("[采集]");
    expect(line).toContain("进行中");
    expect(line).not.toContain("1200");
  });

  it("formatDailyQuestProgressSecondary surfaces chain progress", () => {
    expect(
      formatDailyQuestProgressSecondary({
        quest_cfg_id: 1012,
        state: 2,
        progress_current: 1200,
        progress_target: 5000,
      }),
    ).toBe("链进度 1200/5000");
    expect(
      formatDailyQuestProgressSecondary({
        quest_cfg_id: 1013,
        state: 3,
        progress_current: 5000,
        progress_target: 5000,
      }),
    ).toBe("链进度 5000/5000 · 可领取");
    expect(
      formatDailyQuestProgressSecondary({
        quest_cfg_id: 1012,
        state: 4,
        progress_current: 5000,
        progress_target: 5000,
      }),
    ).toBe("链进度 5000/5000 · 已完成");
    expect(
      formatDailyQuestProgressSecondary({ quest_cfg_id: 1, state: 1, progress_target: 0 }),
    ).toBeNull();
  });
});
