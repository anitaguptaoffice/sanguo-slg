import { describe, expect, it } from "vitest";
import { detectBuildJustCompleted, isSlotUpgradeInProgress } from "@/net/buildQueueComplete";

describe("buildQueueComplete", () => {
  const now = 1_700_000_000_000;

  it("detectBuildJustCompleted when upgrade_finish_at_ms goes in-progress to idle", () => {
    const prev = [{ slot_key: "farm", level: 2, upgrade_finish_at_ms: now + 60_000 }];
    const next = [{ slot_key: "farm", level: 3, upgrade_finish_at_ms: 0 }];
    expect(detectBuildJustCompleted(prev, next, now)).toEqual(["farm"]);
  });

  it("ignores slots that stay in progress or were already idle", () => {
    const prev = [
      { slot_key: "farm", level: 2, upgrade_finish_at_ms: now + 60_000 },
      { slot_key: "hall", level: 1, upgrade_finish_at_ms: 0 },
      { slot_key: "wall", level: 1, upgrade_finish_at_ms: now + 30_000 },
    ];
    const next = [
      { slot_key: "farm", level: 2, upgrade_finish_at_ms: now + 30_000 },
      { slot_key: "hall", level: 2, upgrade_finish_at_ms: 0 },
      { slot_key: "wall", level: 1, upgrade_finish_at_ms: now + 30_000 },
    ];
    expect(detectBuildJustCompleted(prev, next, now)).toEqual([]);
  });

  it("detects multiple completions in one poll", () => {
    const prev = [
      { slot_key: "farm", level: 1, upgrade_finish_at_ms: now + 1 },
      { slot_key: "hall", level: 1, upgrade_finish_at_ms: now + 1 },
    ];
    const next = [
      { slot_key: "farm", level: 2, upgrade_finish_at_ms: 0 },
      { slot_key: "hall", level: 2, upgrade_finish_at_ms: 0 },
    ];
    expect(detectBuildJustCompleted(prev, next, now)).toEqual(["farm", "hall"]);
  });

  it("isSlotUpgradeInProgress matches upgrade_finish_at_ms > now", () => {
    expect(isSlotUpgradeInProgress({ slot_key: "farm", upgrade_finish_at_ms: now + 1 }, now)).toBe(
      true,
    );
    expect(isSlotUpgradeInProgress({ slot_key: "farm", upgrade_finish_at_ms: now }, now)).toBe(
      false,
    );
  });
});
