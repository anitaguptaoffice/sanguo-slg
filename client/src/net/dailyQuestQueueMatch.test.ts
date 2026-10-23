import { describe, expect, it } from "vitest";
import {
  buildingUpgradeMatchesBuildQuest,
  findActiveUpgradeForBuildQuest,
  findBuildDailyQuestForBuilding,
  formatBuildQueueCountdownForQuest,
  formatDailyQuestQueueInlineHint,
  formatLinkedDailyQuestProgressSummary,
  pickNearestActiveQueueEntry,
  resolveBuildLevelQuestTarget,
} from "@/net/dailyQuestQueueMatch";

describe("dailyQuestQueueMatch", () => {
  const now = 1_700_000_000_000;

  it("resolves daily_build_1 target from cfg id or code", () => {
    expect(resolveBuildLevelQuestTarget({ quest_cfg_id: 1032 })).toEqual({
      buildingCfgId: 2,
      level: 2,
    });
    expect(resolveBuildLevelQuestTarget({ quest_code: "daily_build_1" })).toEqual({
      buildingCfgId: 2,
      level: 2,
    });
  });

  it("matches farm upgrade toward Lv2 with in-progress daily_build_1", () => {
    const quest = { quest_cfg_id: 1032, quest_code: "daily_build_1", state: 2 };
    const building = {
      slot_key: "farm",
      building_cfg_id: 2,
      level: 1,
      upgrade_finish_at_ms: now + 90_000,
    };
    expect(buildingUpgradeMatchesBuildQuest(building, quest, now)).toBe(true);
    expect(findBuildDailyQuestForBuilding(building, [quest], now)).toEqual(quest);
    expect(findActiveUpgradeForBuildQuest(quest, [building], now)).toEqual(building);
  });

  it("does not match wrong slot or finished upgrade", () => {
    const quest = { quest_cfg_id: 1032, quest_code: "daily_build_1", state: 2 };
    const hall = {
      slot_key: "hall",
      building_cfg_id: 1,
      level: 1,
      upgrade_finish_at_ms: now + 60_000,
    };
    const doneFarm = {
      slot_key: "farm",
      level: 1,
      upgrade_finish_at_ms: now - 1,
    };
    expect(buildingUpgradeMatchesBuildQuest(hall, quest, now)).toBe(false);
    expect(buildingUpgradeMatchesBuildQuest(doneFarm, quest, now)).toBe(false);
    expect(findBuildDailyQuestForBuilding(hall, [quest], now)).toBeNull();
  });

  it("formats queue countdown summary for daily row", () => {
    const quest = { quest_cfg_id: 1032, quest_code: "daily_build_1", state: 2 };
    const building = {
      slot_key: "farm",
      level: 1,
      upgrade_finish_at_ms: now + 120_000,
    };
    const summary = formatBuildQueueCountdownForQuest(quest, [building], { farm: "农田" }, now);
    expect(summary).toContain("队列：农田");
    expect(summary).toContain("Lv2");
  });

  it("formats linked daily progress for queue build row", () => {
    expect(
      formatLinkedDailyQuestProgressSummary({
        quest_cfg_id: 1032,
        progress_current: 1,
        progress_target: 2,
      }),
    ).toBe("日课 1/2");
  });

  it("picks nearest recruit when train daily and build finishes later", () => {
    const buildings = [
      { slot_key: "farm", level: 1, upgrade_finish_at_ms: now + 200_000 },
    ];
    const recruits = [{ queue_id: 1, unit_cfg_id: 1, count: 20, finish_at_ms: now + 50_000 }];
    const nearest = pickNearestActiveQueueEntry(buildings, recruits, now);
    expect(nearest?.kind).toBe("recruit");
    const trainQuest = { quest_cfg_id: 1014, quest_code: "daily_train_1", state: 2 };
    const hint = formatDailyQuestQueueInlineHint(trainQuest, buildings, recruits, {}, now);
    expect(hint).toContain("步兵");
    expect(hint).toContain("×20");
  });
});
