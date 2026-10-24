import { describe, expect, it } from "vitest";
import { LB_PLAYER_POWER, LB_PLAYER_RESOURCE } from "@/net/leaderboardFormat";
import {
  leaderboardRowShowsHeroDeepLink,
  parseLeaderboardRowHeroId,
} from "@/net/leaderboardRowHeroId";

describe("parseLeaderboardRowHeroId", () => {
  const viewer = 10001;

  it("reads hero_id when in viewer roster", () => {
    expect(
      parseLeaderboardRowHeroId(
        LB_PLAYER_RESOURCE,
        { rank: 1, entity_id: 10002, hero_id: 8002, score: 1 },
        viewer,
        [8001, 8002],
      ),
    ).toBe(8002);
  });

  it("maps viewer power row via player_id / entity_id", () => {
    expect(
      parseLeaderboardRowHeroId(
        LB_PLAYER_POWER,
        { rank: 2, entity_id: viewer, score: 900 },
        viewer,
        [8003],
      ),
    ).toBe(8003);
    expect(
      parseLeaderboardRowHeroId(LB_PLAYER_POWER, { rank: 2, entity_id: viewer, score: 900 }, viewer, []),
    ).toBe(0);
  });

  it("returns null for other players without roster hero", () => {
    expect(
      parseLeaderboardRowHeroId(
        LB_PLAYER_POWER,
        { rank: 1, entity_id: 10002, hero_id: 9001, score: 1 },
        viewer,
        [8001],
      ),
    ).toBeNull();
  });

  it("leaderboardRowShowsHeroDeepLink mirrors parse", () => {
    const entry = { rank: 1, player_id: viewer, score: 1 };
    expect(leaderboardRowShowsHeroDeepLink(LB_PLAYER_RESOURCE, entry, viewer, [7])).toBe(true);
    expect(leaderboardRowShowsHeroDeepLink(LB_PLAYER_RESOURCE, entry, viewer, [])).toBe(true);
  });
});
