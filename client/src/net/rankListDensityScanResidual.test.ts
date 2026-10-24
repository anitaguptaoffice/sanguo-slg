import { describe, expect, it } from "vitest";
import {
  formatLeaderboardRankDeltaLabel,
  formatRankListDensityScanResidualLine,
  leaderboardDensityScanScoreLabel,
  lookupPreviousLeaderboardRank,
} from "@/net/rankListDensityScanResidual";
import { LB_PLAYER_POWER, LB_PLAYER_RESOURCE } from "@/net/leaderboardFormat";

describe("formatRankListDensityScanResidualLine (CLIENT-257)", () => {
  it("labels score dimension per dual board type", () => {
    expect(leaderboardDensityScanScoreLabel(LB_PLAYER_POWER)).toBe("战力");
    expect(leaderboardDensityScanScoreLabel(LB_PLAYER_RESOURCE)).toBe("资源");
  });

  it("formats rank delta labels", () => {
    expect(formatLeaderboardRankDeltaLabel(undefined, 2)).toBe("名次 新入三甲");
    expect(formatLeaderboardRankDeltaLabel(2, 2)).toBe("名次 持平");
    expect(formatLeaderboardRankDeltaLabel(5, 3)).toBe("名次 ↑2");
    expect(formatLeaderboardRankDeltaLabel(2, 4)).toBe("名次 ↓2");
  });

  it("combines delta and score scan subline", () => {
    const line = formatRankListDensityScanResidualLine(LB_PLAYER_POWER, { rank: 1, score: 15_000 }, 2);
    expect(line).toContain("密度扫读");
    expect(line).toContain("名次 ↑1");
    expect(line).toContain("战力");
    expect(line).toContain("1.5万");
  });

  it("looks up previous rank by entity id", () => {
    const prev = [
      { rank: 1, entity_id: 9, score: 100 },
      { rank: 2, entity_id: 8, score: 90 },
    ];
    expect(lookupPreviousLeaderboardRank(prev, { rank: 1, entity_id: 8, score: 95 })).toBe(2);
  });

  it("returns null without current rank", () => {
    expect(formatRankListDensityScanResidualLine(LB_PLAYER_POWER, { rank: 0, score: 1 })).toBeNull();
  });
});
