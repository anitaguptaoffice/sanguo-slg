import {
  LB_PLAYER_POWER,
  LB_PLAYER_RESOURCE,
  type LeaderboardEntryRow,
} from "@/net/leaderboardFormat";
import {
  pickViewerHeroIdForRankRow,
  resolvePowerBoardHeroId,
} from "@/net/rankRowDeepLink";

/**
 * 从排行列表行解析将领深链 hero_id（网关快照可选 `hero_id` / `player_id`，非新 rank proto）。
 * 返回 `0` 表示己方行但需 UI 从将领列表兜底；`null` 表示不可展示将领深链。
 */
export function parseLeaderboardRowHeroId(
  boardType: number,
  entry: LeaderboardEntryRow,
  viewerPlayerId: number,
  viewerHeroIds: readonly number[],
): number | null {
  const entityId = entry.entity_id ?? entry.player_id ?? 0;
  const entryHero = entry.hero_id ?? 0;

  if (entryHero > 0) {
    if (viewerHeroIds.includes(entryHero)) return entryHero;
    if (viewerPlayerId > 0 && entityId === viewerPlayerId) return entryHero;
    return null;
  }

  if (boardType !== LB_PLAYER_POWER && boardType !== LB_PLAYER_RESOURCE) {
    return null;
  }

  const mapped = resolvePowerBoardHeroId(entityId, viewerPlayerId, viewerHeroIds);
  if (mapped != null) return mapped > 0 ? mapped : 0;
  if (entityId > 0 && entityId === viewerPlayerId) {
    const pick = pickViewerHeroIdForRankRow(viewerHeroIds);
    return pick > 0 ? pick : 0;
  }
  return null;
}

export function leaderboardRowShowsHeroDeepLink(
  boardType: number,
  entry: LeaderboardEntryRow,
  viewerPlayerId: number,
  viewerHeroIds: readonly number[],
): boolean {
  return parseLeaderboardRowHeroId(boardType, entry, viewerPlayerId, viewerHeroIds) !== null;
}
