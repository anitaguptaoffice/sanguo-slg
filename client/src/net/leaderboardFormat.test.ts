import { describe, expect, it } from "vitest";
import {
  formatLeaderboardEntryLine,
  formatLeaderboardSnapshotMeta,
  formatViewerRankSummary,
  LB_PLAYER_POWER,
  LB_PLAYER_RESOURCE,
  selectedLeaderboardTypeFromValue,
} from "@/net/leaderboardFormat";

describe("leaderboardFormat", () => {
  it("formats viewer rank when on board", () => {
    const text = formatViewerRankSummary(LB_PLAYER_POWER, 3, 9900);
    expect(text).toContain("第 3 名");
    expect(text).toContain("玩家战力");
    expect(text).toContain("9900");
  });

  it("formats viewer as unranked with score label per type", () => {
    expect(formatViewerRankSummary(LB_PLAYER_POWER, 0, 120)).toContain("未上榜");
    expect(formatViewerRankSummary(LB_PLAYER_RESOURCE, undefined, 5000)).toContain("资源总量");
    expect(formatViewerRankSummary(LB_PLAYER_RESOURCE, 0, undefined, 88)).toContain("88");
  });

  it("formats entry line with entity id fallback", () => {
    expect(formatLeaderboardEntryLine({ rank: 1, display_name: "甲", score: 100 })).toBe("1. 甲 · 100");
    expect(formatLeaderboardEntryLine({ rank: 2, entity_id: 42, score: 50 })).toBe("2. 玩家#42 · 50");
  });

  it("builds snapshot meta from batch_id or snapshot_version", () => {
    const at = 1_700_000_000_000;
    expect(formatLeaderboardSnapshotMeta({ batch_id: 7, snapshot_refreshed_at_ms: at }, at + 120_000)).toContain(
      "快照批次 #7",
    );
    expect(formatLeaderboardSnapshotMeta({ snapshot_version: 3 }, at)).toContain("快照批次 #3");
    expect(formatLeaderboardSnapshotMeta({})).toBeNull();
  });

  it("maps type selector values", () => {
    expect(selectedLeaderboardTypeFromValue("2")).toBe(LB_PLAYER_RESOURCE);
    expect(selectedLeaderboardTypeFromValue("1")).toBe(LB_PLAYER_POWER);
    expect(selectedLeaderboardTypeFromValue("99")).toBe(LB_PLAYER_POWER);
  });
});
