import { describe, expect, it } from "vitest";
import { formatNextQueueFinishPreviewLine } from "@/net/nextQueueFinishPreview";

describe("formatNextQueueFinishPreviewLine (CLIENT-218)", () => {
  const now = 1_700_000_000_000;

  it("picks earliest build finish and links matching daily quest", () => {
    const preview = formatNextQueueFinishPreviewLine(
      [
        { slot_key: "farm", level: 1, upgrade_finish_at_ms: now + 90_000 },
        { slot_key: "hall", level: 2, upgrade_finish_at_ms: now + 300_000 },
      ],
      [],
      { farm: "农田" },
      [
        {
          quest_cfg_id: 1032,
          quest_code: "daily_build_1",
          state: 2,
          progress_current: 0,
          progress_target: 1,
        },
      ],
      now,
    );
    expect(preview?.line).toContain("下一完成");
    expect(preview?.line).toContain("农田");
    expect(preview?.line).toContain("<1h");
    expect(preview?.questCfgId).toBe(1032);
  });

  it("picks recruit queue when it finishes sooner", () => {
    const preview = formatNextQueueFinishPreviewLine(
      [{ slot_key: "farm", level: 1, upgrade_finish_at_ms: now + 300_000 }],
      [{ queue_id: 7, unit_cfg_id: 1, count: 5, finish_at_ms: now + 45_000 }],
      { farm: "农田" },
      [
        {
          quest_cfg_id: 1014,
          quest_code: "daily_train_1",
          state: 2,
          progress_current: 0,
          progress_target: 1,
        },
      ],
      now,
    );
    expect(preview?.line).toContain("[募兵]");
    expect(preview?.questCfgId).toBe(1014);
  });

  it("returns null when no active queue", () => {
    expect(formatNextQueueFinishPreviewLine([], [], {}, [], now)).toBeNull();
  });
});
