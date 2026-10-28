// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  dailyObjectiveKindForQuest,
  dailyObjectiveLabel,
  dailyObjectiveLabelForQuest,
  formatDailyQuestNextStepHint,
  formatDailyQuestLineWithObjective,
  MARCH_RATION_ITEM_CFG_ID,
  resolveDailyQuestNavAction,
} from "@/net/dailyQuestObjective";

describe("dailyQuestObjective", () => {
  it("maps chain 400 quest codes to objective labels", () => {
    expect(dailyObjectiveLabelForQuest({ quest_code: "daily_food_1" })).toBe("采集");
    expect(dailyObjectiveLabelForQuest({ quest_code: "daily_recruit_1" })).toBe("招募");
    expect(dailyObjectiveLabelForQuest({ quest_code: "daily_train_1" })).toBe("练兵");
    expect(dailyObjectiveLabelForQuest({ quest_code: "daily_build_1" })).toBe("建造");
    expect(dailyObjectiveLabelForQuest({ quest_code: "daily_march_1" })).toBe("战备");
  });

  it("falls back to quest_cfg_id when code missing", () => {
    expect(dailyObjectiveKindForQuest({ quest_cfg_id: 1014 })).toBe("train_troops");
    expect(dailyObjectiveKindForQuest({ quest_cfg_id: 1032 })).toBe("build_level");
    expect(dailyObjectiveKindForQuest({ quest_cfg_id: 1033 })).toBe("use_item");
    expect(dailyObjectiveLabel("use_item")).toBe("使用道具");
  });

  it("formats list line with objective tag and progress", () => {
    const line = formatDailyQuestLineWithObjective({
      quest_cfg_id: 1014,
      quest_code: "daily_train_1",
      state: 2,
      progress_current: 10,
      progress_target: 50,
    });
    expect(line).toContain("[练兵]");
    expect(line).toContain("daily_train_1");
    expect(line).toContain("10/50");
  });

  it("resolves next-step navigation for QUEST-003 types", () => {
    const train = resolveDailyQuestNavAction({
      quest_cfg_id: 1014,
      quest_code: "daily_train_1",
      state: 2,
    });
    expect(train).toEqual({ kind: "train_troops" });
    expect(formatDailyQuestNextStepHint(train!)).toContain("队列");

    const build = resolveDailyQuestNavAction({
      quest_cfg_id: 1032,
      quest_code: "daily_build_1",
      state: 2,
    });
    expect(build?.kind).toBe("build_level");

    const march = resolveDailyQuestNavAction({
      quest_cfg_id: 1033,
      quest_code: "daily_march_1",
      state: 1,
    });
    expect(march).toEqual({ kind: "use_item", itemCfgId: MARCH_RATION_ITEM_CFG_ID });
    expect(formatDailyQuestNextStepHint(march!)).toContain(String(MARCH_RATION_ITEM_CFG_ID));

    expect(
      resolveDailyQuestNavAction({ quest_cfg_id: 1014, quest_code: "daily_train_1", state: 3 }),
    ).toBeNull();
  });
});
