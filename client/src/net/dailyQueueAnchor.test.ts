import { describe, expect, it, vi } from "vitest";
import {
  DAILY_QUEUE_ANCHOR_HIGHLIGHT_CLASS,
  DAILY_QUEUE_ANCHOR_HIGHLIGHT_MS,
  resolveDailyQueueAnchorTarget,
  scrollDailyQuestCfgRowIntoView,
} from "@/net/dailyQueueAnchor";

describe("resolveDailyQueueAnchorTarget", () => {
  const now = 1_700_000_000_000;

  it("resolves build slot for daily_build_1 with matching farm upgrade", () => {
    const quest = {
      quest_cfg_id: 1032,
      quest_code: "daily_build_1",
      state: 2,
      progress_current: 0,
      progress_target: 1,
    };
    const buildings = [{ slot_key: "farm", level: 1, upgrade_finish_at_ms: now + 60_000 }];
    expect(resolveDailyQueueAnchorTarget(quest, buildings, [], now)).toEqual({
      kind: "build",
      slotKey: "farm",
    });
  });

  it("resolves earliest active recruit for daily_train_1", () => {
    const quest = {
      quest_cfg_id: 1014,
      quest_code: "daily_train_1",
      state: 2,
      progress_current: 0,
      progress_target: 1,
    };
    const recruits = [
      { queue_id: 2, unit_cfg_id: 1, count: 10, finish_at_ms: now + 120_000 },
      { queue_id: 5, unit_cfg_id: 1, count: 8, finish_at_ms: now + 40_000 },
    ];
    expect(resolveDailyQueueAnchorTarget(quest, [], recruits, now)).toEqual({
      kind: "recruit",
      queueId: 5,
    });
  });

  it("returns null when quest does not need queue anchor", () => {
    const quest = {
      quest_cfg_id: 1033,
      quest_code: "daily_march_1",
      state: 2,
      progress_current: 0,
      progress_target: 1,
    };
    expect(resolveDailyQueueAnchorTarget(quest, [], [], now)).toBeNull();
  });
});

describe("daily queue anchor highlight constants", () => {
  it("exports highlight class and 2s duration", () => {
    expect(DAILY_QUEUE_ANCHOR_HIGHLIGHT_CLASS).toBe("daily-queue-anchor-highlight");
    expect(DAILY_QUEUE_ANCHOR_HIGHLIGHT_MS).toBe(2000);
  });
});

describe("scrollDailyQuestCfgRowIntoView", () => {
  it("scrolls matching quest_cfg row", () => {
    const root = document.createElement("div");
    const li = document.createElement("li");
    li.setAttribute("data-quest-cfg-id", "1032");
    root.appendChild(li);
    const scrolled = vi.fn();
    li.scrollIntoView = scrolled;
    scrollDailyQuestCfgRowIntoView(root, 1032);
    expect(scrolled).toHaveBeenCalledWith({ block: "nearest", behavior: "smooth" });
  });
});
