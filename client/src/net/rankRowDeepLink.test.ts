import { describe, expect, it } from "vitest";
import { LB_PLAYER_POWER, LB_PLAYER_RESOURCE } from "@/net/leaderboardFormat";
import {
  formatRankReadonlySummary,
  RANK_HERO_VIEWER_ONLY_TOAST,
  resolvePowerBoardHeroId,
  resolveRankRowDeepLink,
} from "@/net/rankRowDeepLink";

describe("resolveRankRowDeepLink", () => {
  const viewer = 10001;

  it("power board maps viewer row to hero deep link", () => {
    expect(
      resolveRankRowDeepLink(LB_PLAYER_POWER, { rank: 2, entity_id: viewer, score: 900 }, viewer),
    ).toEqual({ kind: "hero", heroId: 0 });
    expect(
      resolveRankRowDeepLink(
        LB_PLAYER_POWER,
        { rank: 2, entity_id: viewer, score: 900 },
        viewer,
        [8003, 8001],
      ),
    ).toEqual({ kind: "hero", heroId: 8003 });
  });

  it("power board maps entity_id in viewer hero roster", () => {
    expect(
      resolveRankRowDeepLink(
        LB_PLAYER_POWER,
        { rank: 1, entity_id: 8002, score: 12000 },
        viewer,
        [8001, 8002],
      ),
    ).toEqual({ kind: "hero", heroId: 8002 });
  });

  it("power board rejects other players with toast", () => {
    expect(
      resolveRankRowDeepLink(LB_PLAYER_POWER, { rank: 1, entity_id: 10002, score: 12000 }, viewer),
    ).toEqual({ kind: "toast", message: RANK_HERO_VIEWER_ONLY_TOAST });
  });

  it("resource board opens world grid when coords present", () => {
    expect(
      resolveRankRowDeepLink(
        LB_PLAYER_RESOURCE,
        { rank: 3, entity_id: 10002, display_name: "富贾", score: 5000, grid_x: 12, grid_y: 34 },
        viewer,
      ),
    ).toEqual({ kind: "world-grid", gridX: 12, gridY: 34 });
  });

  it("resource board viewer row prefers world panel without coords", () => {
    expect(
      resolveRankRowDeepLink(
        LB_PLAYER_RESOURCE,
        { rank: 5, entity_id: viewer, score: 800 },
        viewer,
      ),
    ).toEqual({ kind: "world-viewer" });
  });

  it("resource board other players fall back to readonly summary", () => {
    expect(
      resolveRankRowDeepLink(
        LB_PLAYER_RESOURCE,
        { rank: 1, entity_id: 10002, display_name: "富贾", score: 25000 },
        viewer,
      ),
    ).toEqual({ kind: "summary" });
  });
});

describe("resolvePowerBoardHeroId", () => {
  it("returns null when viewer has no heroes on own row", () => {
    expect(resolvePowerBoardHeroId(10001, 10001, [])).toBeNull();
  });
});

describe("formatRankReadonlySummary", () => {
  it("includes grid and city when present", () => {
    const text = formatRankReadonlySummary(LB_PLAYER_RESOURCE, {
      rank: 2,
      entity_id: 9,
      display_name: "甲",
      score: 100,
      city_x: 5,
      city_y: 6,
      city_name: "洛阳",
    });
    expect(text).toContain("甲");
    expect(text).toContain("(5, 6)");
    expect(text).toContain("洛阳");
  });
});
