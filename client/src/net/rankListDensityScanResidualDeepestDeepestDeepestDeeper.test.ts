import { describe, expect, it } from "vitest";
import { formatRankListDensityScanResidualDeepestDeepestDeepestDeeperLine } from "@/net/rankListDensityScanResidualDeepestDeepestDeepestDeeper";
import { LB_PLAYER_POWER, LB_PLAYER_RESOURCE } from "@/net/leaderboardFormat";

describe("formatRankListDensityScanResidualDeepestDeepestDeepestDeeperLine (CLIENT-369)", () => {
  it("deepens CLIENT-353 residual with rank delta and score consolidation", () => {
    const line = formatRankListDensityScanResidualDeepestDeepestDeepestDeeperLine(
      LB_PLAYER_POWER,
      { rank: 1, score: 15_000 },
      2,
    );
    expect(line).toContain("扫读巩固再加深五层");
    expect(line).toContain("玩家战力");
    expect(line).toContain("名次 ↑1");
    expect(line).toContain("战力");
    expect(line).toContain("1.5万");
    expect(line).toContain("双榜密度");
    expect(line).toContain("加深 扫读巩固再加深四层");
  });

  it("labels resource board score dimension", () => {
    const line = formatRankListDensityScanResidualDeepestDeepestDeepestDeeperLine(
      LB_PLAYER_RESOURCE,
      { rank: 2, score: 900 },
      2,
    );
    expect(line).toContain("资源");
    expect(line).toContain("名次 持平");
  });

  it("returns null without residual deepest-deepest-deepest baseline", () => {
    expect(
      formatRankListDensityScanResidualDeepestDeepestDeepestDeeperLine(LB_PLAYER_POWER, {
        rank: 0,
        score: 1,
      }),
    ).toBeNull();
  });
});
