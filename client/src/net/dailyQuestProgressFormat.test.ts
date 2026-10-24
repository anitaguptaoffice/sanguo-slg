import { describe, expect, it } from "vitest";
import {
  clampDailyQuestProgressPercent,
  formatDailyQuestProgressSecondary,
  formatDailyQuestRewardLine,
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

  it("formatDailyQuestRewardLine surfaces cfg item reward or omits (CLIENT-174)", () => {
    expect(
      formatDailyQuestRewardLine({ quest_cfg_id: 1012, quest_code: "daily_food_1", state: 2 }),
    ).toBeNull();
    expect(
      formatDailyQuestRewardLine({ quest_cfg_id: 1014, quest_code: "daily_train_1", state: 2 }),
    ).toBe("奖励 急工符·五刻×1");
    expect(
      formatDailyQuestRewardLine({
        quest_cfg_id: 9999,
        reward_item_id: 2001,
        quantity: 3,
      }),
    ).toBe("奖励 谷袋·初备×3");
  });

  it("clampDailyQuestProgressPercent clamps width percent (CLIENT-174)", () => {
    expect(clampDailyQuestProgressPercent(0, 0)).toBeNull();
    expect(clampDailyQuestProgressPercent(1200, 5000)).toBe(24);
    expect(clampDailyQuestProgressPercent(6000, 5000)).toBe(100);
    expect(clampDailyQuestProgressPercent(-10, 100)).toBe(0);
  });
});
