import { describe, expect, it } from "vitest";
import {
  DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_CLASS,
  DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPER_SUBLINE_CLASS,
  DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_SUBLINE_CLASS,
  DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPER_SUBLINE_CLASS,
  DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS,
  formatQuestChainQueueHudResidualDeepSubline,
  formatQuestChainQueueHudResidualDeeperSubline,
  formatQuestChainQueueHudResidualDeepestDeepestDeeperSubline,
  formatQuestChainQueueHudResidualDeepestDeeperSubline,
  formatQuestChainQueueHudResidualDeepestSubline,
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

describe("formatQuestChainQueueHudResidualDeeperSubline (CLIENT-282)", () => {
  const now = 1_700_000_000_000;

  it("consolidates chain type with queue ETA on third line for claimable rows", () => {
    const line = formatQuestChainQueueHudResidualDeeperSubline(
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
    expect(line).toContain("巩固再加深");
    expect(line).toContain("主线");
    expect(line).toContain("队列下一完成");
    expect(line).toContain("↔");
    expect(line).toContain("对照");
    expect(line).toContain("深链巩固");
  });

  it("returns null when no active queue", () => {
    expect(
      formatQuestChainQueueHudResidualDeeperSubline(
        { quest_cfg_id: 1013, chain_id: 400, state: 3 },
        [],
        [],
        {},
        [],
        now,
      ),
    ).toBeNull();
  });

  it("exports deeper subline DOM class", () => {
    expect(DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPER_SUBLINE_CLASS).toBe(
      "daily-quest-chain-queue-hud-residual-deeper-subline",
    );
  });
});

describe("formatQuestChainQueueHudResidualDeepestSubline (CLIENT-298)", () => {
  const now = 1_700_000_000_000;

  it("consolidates chain type with queue ETA on fourth line for claimable rows", () => {
    const line = formatQuestChainQueueHudResidualDeepestSubline(
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
    expect(line).toContain("巩固再加深一层");
    expect(line).toContain("主线");
    expect(line).toContain("队列下一完成");
    expect(line).toContain("↔");
    expect(line).toContain("对照");
    expect(line).toContain("巩固再加深");
    expect(line).toContain("深链巩固");
  });

  it("returns null when no active queue", () => {
    expect(
      formatQuestChainQueueHudResidualDeepestSubline(
        { quest_cfg_id: 1013, chain_id: 400, state: 3 },
        [],
        [],
        {},
        [],
        now,
      ),
    ).toBeNull();
  });

  it("exports deepest subline DOM class", () => {
    expect(DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_SUBLINE_CLASS).toBe(
      "daily-quest-chain-queue-hud-residual-deepest-subline",
    );
  });
});

describe("formatQuestChainQueueHudResidualDeepestDeeperSubline (CLIENT-314)", () => {
  const now = 1_700_000_000_000;

  it("consolidates chain type with queue ETA on deepest-deeper line for claimable rows", () => {
    const line = formatQuestChainQueueHudResidualDeepestDeeperSubline(
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
    expect(line).toContain("巩固再加深二层");
    expect(line).toContain("主线");
    expect(line).toContain("队列下一完成");
    expect(line).toContain("↔");
    expect(line).toContain("对照");
    expect(line).toContain("巩固再加深一层");
    expect(line).toContain("深链巩固");
  });

  it("returns null when no active queue", () => {
    expect(
      formatQuestChainQueueHudResidualDeepestDeeperSubline(
        { quest_cfg_id: 1013, chain_id: 400, state: 3 },
        [],
        [],
        {},
        [],
        now,
      ),
    ).toBeNull();
  });

  it("exports deepest-deeper subline DOM class", () => {
    expect(DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPER_SUBLINE_CLASS).toBe(
      "daily-quest-chain-queue-hud-residual-deepest-deeper-subline",
    );
  });
});

describe("formatQuestChainQueueHudResidualDeepestDeepestDeeperSubline (CLIENT-330)", () => {
  const now = 1_700_000_000_000;

  it("consolidates chain type with queue ETA on deepest-deepest-deeper line for claimable rows", () => {
    const line = formatQuestChainQueueHudResidualDeepestDeepestDeeperSubline(
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
    expect(line).toContain("巩固再加深三层");
    expect(line).toContain("主线");
    expect(line).toContain("队列下一完成");
    expect(line).toContain("↔");
    expect(line).toContain("对照");
    expect(line).toContain("巩固再加深二层");
    expect(line).toContain("深链巩固");
  });

  it("returns null when no active queue", () => {
    expect(
      formatQuestChainQueueHudResidualDeepestDeepestDeeperSubline(
        { quest_cfg_id: 1013, chain_id: 400, state: 3 },
        [],
        [],
        {},
        [],
        now,
      ),
    ).toBeNull();
  });

  it("exports deepest-deepest-deeper subline DOM class", () => {
    expect(DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS).toBe(
      "daily-quest-chain-queue-hud-residual-deepest-deepest-deeper-subline",
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
