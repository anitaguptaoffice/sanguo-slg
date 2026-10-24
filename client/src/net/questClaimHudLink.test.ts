import { describe, expect, it } from "vitest";
import {
  formatMailDailyHudCombinedSweepLine,
  formatMailPanelHudCombinedSweepLine,
  formatQuestClaimHudLinkLine,
} from "@/net/questClaimHudLink";
import { DAILY_QUEST_STATE_CLAIMABLE } from "@/net/hudTodoBadge";

describe("formatQuestClaimHudLinkLine (CLIENT-209)", () => {
  it("returns null when no claimable quests", () => {
    expect(formatQuestClaimHudLinkLine([])).toBeNull();
    expect(formatQuestClaimHudLinkLine([{ quest_cfg_id: 1, state: 1 }])).toBeNull();
  });

  it("includes first quest_cfg_id", () => {
    expect(
      formatQuestClaimHudLinkLine([
        { quest_cfg_id: 10, state: DAILY_QUEST_STATE_CLAIMABLE },
        { quest_cfg_id: 20, state: DAILY_QUEST_STATE_CLAIMABLE },
      ]),
    ).toBe("日常可领 2 · #10");
  });
});

describe("formatMailDailyHudCombinedSweepLine (CLIENT-209)", () => {
  it("merges mail tab sweep with quest HUD line", () => {
    expect(
      formatMailDailyHudCombinedSweepLine({
        mailTabSweep: "未读 2 · 未领附件 1",
        questClaimHud: "日常可领 1 · #88",
      }),
    ).toBe("未读 2 · 未领附件 1 · 日常可领 1 · #88");
    expect(
      formatMailPanelHudCombinedSweepLine(
        { unreadForTab: 1, unclaimedCount: 0 },
        [{ quest_cfg_id: 5, state: DAILY_QUEST_STATE_CLAIMABLE }],
      ),
    ).toBe("未读 1 · 日常可领 1 · #5");
  });
});
