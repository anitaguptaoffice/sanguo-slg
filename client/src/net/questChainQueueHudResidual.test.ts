import { describe, expect, it } from "vitest";
import {
  DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_CLASS,
  formatQuestChainQueueHudResidualDeepSubline,
  formatQuestChainQueueHudResidualQueueEtaSnippet,
  formatQuestChainQueueHudResidualSubline,
} from "@/net/questChainQueueHudResidual";

describe("formatQuestChainQueueHudResidualSubline (CLIENT-250)", () => {
  const now = 1_700_000_000_000;

  it("combines chain label with next queue finish ETA for claimable rows", () => {
    const line = formatQuestChainQueueHudResidualSubline(
      {
        quest_cfg_id: 1013,
        chain_id: 400,
        state: 3,
        progress_current: 4,
        progress_target: 4,
      },
      [{ slot_key: "farm", level: 1, upgrade_finish_at_ms: now + 90_000 }],
      [],
      { farm: "农田" },
      [],
      now,
    );
    expect(line).toBe("主线 · 队列下一完成 <1h");
  });

  it("returns null for non-claimable rows", () => {
    expect(
      formatQuestChainQueueHudResidualSubline(
        { quest_cfg_id: 1014, chain_id: 400, state: 2 },
        [{ slot_key: "farm", level: 1, upgrade_finish_at_ms: now + 90_000 }],
        [],
        {},
        [],
        now,
      ),
    ).toBeNull();
  });

  it("returns null when no active queue", () => {
    expect(
      formatQuestChainQueueHudResidualSubline(
        { quest_cfg_id: 1013, chain_id: 400, state: 3 },
        [],
        [],
        {},
        [],
        now,
      ),
    ).toBeNull();
  });
});

describe("formatQuestChainQueueHudResidualDeepSubline (CLIENT-266)", () => {
  const now = 1_700_000_000_000;

  it("consolidates CLIENT-218 chain hint with queue ETA for claimable rows", () => {
    const line = formatQuestChainQueueHudResidualDeepSubline(
      {
        quest_cfg_id: 1013,
        chain_id: 400,
        state: 3,
        progress_current: 4,
        progress_target: 4,
      },
      [{ slot_key: "farm", level: 1, upgrade_finish_at_ms: now + 90_000 }],
      [],
      { farm: "农田" },
      [],
      now,
    );
    expect(line).toContain("深链巩固");
    expect(line).toContain("主线");
    expect(line).toContain("队列下一完成");
    expect(line).toContain("↔");
  });

  it("returns null when no active queue", () => {
    expect(
      formatQuestChainQueueHudResidualDeepSubline(
        { quest_cfg_id: 1013, chain_id: 400, state: 3 },
        [],
        [],
        {},
        [],
        now,
      ),
    ).toBeNull();
  });

  it("exports deep subline DOM class", () => {
    expect(DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_CLASS).toBe(
      "daily-quest-chain-queue-hud-residual-deep-subline",
    );
  });
});

describe("formatQuestChainQueueHudResidualQueueEtaSnippet (CLIENT-250)", () => {
  const now = 1_700_000_000_000;

  it("uses domestic queue segment label when available", () => {
    expect(formatQuestChainQueueHudResidualQueueEtaSnippet(now + 45_000, now)).toContain(
      "队列下一完成",
    );
  });
});
