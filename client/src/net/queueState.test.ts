import { describe, expect, it } from "vitest";
import {
  activeBuildingUpgrades,
  formatBuildQueueCountdown,
  formatBuildingUpgradeQueueLine,
  formatQueuePanelOverviewBar,
  formatRecruitQueueLine,
  isQueuedRecruitResponse,
  mergeRecruitQueue,
  nearestQueueFinishAtMs,
  queuePanelHasCountdown,
  recruitEntryFromResponse,
  sortBuildQueueRows,
} from "@/net/queueState";

describe("queueState", () => {
  const now = 10_000_000;

  it("detects queued recruit response", () => {
    expect(isQueuedRecruitResponse({ queue_id: 0, finish_at_ms: 0 })).toBe(false);
    expect(isQueuedRecruitResponse({ queue_id: 2, finish_at_ms: now + 1000 })).toBe(true);
    expect(
      recruitEntryFromResponse({ queue_id: 3, finish_at_ms: now + 5000 }, 2, 40),
    ).toEqual({
      queue_id: 3,
      unit_cfg_id: 2,
      count: 40,
      finish_at_ms: now + 5000,
    });
  });

  it("lists active building upgrades sorted by finish time", () => {
    const buildings = [
      { slot_key: "farm", level: 2, upgrade_finish_at_ms: now + 3000 },
      { slot_key: "hall", level: 1, upgrade_finish_at_ms: now + 1000 },
      { slot_key: "wall", level: 1, upgrade_finish_at_ms: now - 1 },
    ];
    expect(sortBuildQueueRows(buildings, now).map((b) => b.slot_key)).toEqual(["hall", "farm"]);
    expect(activeBuildingUpgrades(buildings, now).map((b) => b.slot_key)).toEqual(["hall", "farm"]);
  });

  it("formats upgrade and recruit queue lines with remaining time", () => {
    const up = formatBuildingUpgradeQueueLine(
      { slot_key: "farm", level: 4, upgrade_finish_at_ms: now + 120_000 },
      { farm: "农田" },
      now,
    );
    expect(up).toContain("[内政] 农田 → Lv5");
    expect(up).toContain("剩 2:00");

    const rec = formatRecruitQueueLine(
      { queue_id: 7, unit_cfg_id: 1, count: 30, finish_at_ms: now + 90_000 },
      now,
    );
    expect(rec).toContain("[募兵] 步兵×30");
    expect(rec).toContain("#7");
    expect(rec).toContain("剩 1:30");
  });

  it("formatBuildQueueCountdown and queue overview bar", () => {
    const recruits = [{ queue_id: 1, unit_cfg_id: 1, count: 10, finish_at_ms: now + 90_000 }];
    const buildings = [
      { slot_key: "hall", level: 1, upgrade_finish_at_ms: now + 60_000 },
      { slot_key: "farm", level: 2, upgrade_finish_at_ms: now + 120_000 },
    ];
    expect(nearestQueueFinishAtMs(buildings, recruits, now)).toBe(now + 60_000);
    expect(formatBuildQueueCountdown(now + 90_000, now)).toBe("最近 剩 1:30");
    expect(formatQueuePanelOverviewBar(buildings, recruits, now)).toBe(
      "建造 2 · 募兵 1 · 最近 剩 1:00",
    );
    expect(formatQueuePanelOverviewBar([], [], now)).toBe("建造 0 · 募兵 0");
  });

  it("mergeRecruitQueue and queuePanelHasCountdown", () => {
    const a = { queue_id: 1, unit_cfg_id: 1, count: 10, finish_at_ms: now + 100 };
    expect(mergeRecruitQueue([a], { ...a, count: 20 })[0].count).toBe(20);
    expect(queuePanelHasCountdown([], [], now)).toBe(false);
    expect(queuePanelHasCountdown([{ slot_key: "farm", upgrade_finish_at_ms: now + 1 }], [], now)).toBe(
      true,
    );
  });
});
