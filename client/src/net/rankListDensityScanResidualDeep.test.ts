import { describe, expect, it } from "vitest";
import { formatRankListDensityScanResidualDeepLine } from "@/net/rankListDensityScanResidualDeep";
import { LB_PLAYER_POWER, LB_PLAYER_RESOURCE } from "@/net/leaderboardFormat";

describe("formatRankListDensityScanResidualDeepLine (CLIENT-273)", () => {
  it("deepens CLIENT-257 residual with rank delta and score scan", () => {
    const line = formatRankListDensityScanResidualDeepLine(
      LB_PLAYER_POWER,
      { rank: 1, score: 15_000 },
      2,
    );
    expect(line).toContain("扫读加深");
    expect(line).toContain("玩家战力");
    expect(line).toContain("名次 ↑1");
    expect(line).toContain("战力");
    expect(line).toContain("1.5万");
    expect(line).toContain("残余 密度扫读");
  });

  it("labels resource board score dimension", () => {
    const line = formatRankListDensityScanResidualDeepLine(
      LB_PLAYER_RESOURCE,
      { rank: 2, score: 900 },
      2,
    );
    expect(line).toContain("资源");
    expect(line).toContain("名次 持平");
  });

  it("returns null without residual baseline", () => {
    expect(
      formatRankListDensityScanResidualDeepLine(LB_PLAYER_POWER, { rank: 0, score: 1 }),
    ).toBeNull();
  });
});
