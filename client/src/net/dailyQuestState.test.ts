import { describe, expect, it } from "vitest";
import {
  DAILY_QUEST_CHAIN_ID,
  DEFAULT_DAILY_QUEST_CFG_ID,
  dailyQuestsFromListResponse,
  formatDailyQuestDetail,
  formatDailyQuestLine,
  pickDefaultDailyQuest,
} from "@/net/dailyQuestState";

describe("dailyQuestState", () => {
  it("uses chain 400 constant", () => {
    expect(DAILY_QUEST_CHAIN_ID).toBe(400);
    expect(DEFAULT_DAILY_QUEST_CFG_ID).toBe(1012);
  });

  it("formats daily quest line with progress and state", () => {
    const line = formatDailyQuestLine({
      quest_cfg_id: 1012,
      quest_code: "daily_food_1",
      state: 2,
      progress_current: 1200,
      progress_target: 5000,
    });
    expect(line).toContain("daily_food_1");
    expect(line).toContain("1200/5000");
    expect(line).toContain("进行中");
  });

  it("parses list response and picks default cfg", () => {
    const rows = dailyQuestsFromListResponse({
      quests: [
        { quest_cfg_id: 1013, quest_code: "daily_wood_1", state: 1 },
        { quest_cfg_id: 1012, quest_code: "daily_food_1", state: 1 },
      ],
    });
    expect(rows).toHaveLength(2);
    const pick = pickDefaultDailyQuest(rows);
    expect(pick?.quest_cfg_id).toBe(1012);
    expect(formatDailyQuestDetail(pick)).toContain("daily_food_1");
  });
});
