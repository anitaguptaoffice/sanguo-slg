import { describe, expect, it } from "vitest";
import { formatRankListDensityScanResidualDeeperLine } from "@/net/rankListDensityScanResidualDeeper";
import { LB_PLAYER_POWER, LB_PLAYER_RESOURCE } from "@/net/leaderboardFormat";

describe("formatRankListDensityScanResidualDeeperLine (CLIENT-289)", () => {
  it("deepens CLIENT-273 residual with rank delta and score consolidation", () => {
    const line = formatRankListDensityScanResidualDeeperLine(
      LB_PLAYER_POWER,
      { rank: 1, score: 15_000 },
      2,
    );
    expect(line).toContain("扫读巩固再加深");
    expect(line).toContain("玩家战力");
    expect(line).toContain("名次 ↑1");
    expect(line).toContain("战力");
    expect(line).toContain("1.5万");
    expect(line).toContain("双榜密度");
    expect(line).toContain("加深 扫读加深");
  });

  it("labels resource board score dimension", () => {
    const line = formatRankListDensityScanResidualDeeperLine(
      LB_PLAYER_RESOURCE,
      { rank: 2, score: 900 },
      2,
    );
    expect(line).toContain("资源");
    expect(line).toContain("名次 持平");
  });

  it("returns null without residual deep baseline", () => {
    expect(
      formatRankListDensityScanResidualDeeperLine(LB_PLAYER_POWER, { rank: 0, score: 1 }),
    ).toBeNull();
  });
});
