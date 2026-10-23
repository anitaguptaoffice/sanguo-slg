import {
  LB_PLAYER_POWER,
  LB_PLAYER_RESOURCE,
  leaderboardScoreLabel,
  type LeaderboardEntryRow,
} from "@/net/leaderboardFormat";

export const RANK_HERO_VIEWER_ONLY_TOAST = "仅支持查看己方将领";

export type RankRowDeepLink =
  | { kind: "none" }
  | { kind: "toast"; message: string }
  | { kind: "hero"; heroId: number }
  | { kind: "world-grid"; gridX: number; gridY: number }
  | { kind: "world-viewer" }
  | { kind: "summary" };

/** 战力榜 entity_id 与 viewer 将领 hero_id 对齐时的兼容（联调/快照扩展）。 */
export function rankPowerEntityMatchesViewerHero(
  entityId: number,
  viewerHeroIds: readonly number[],
): number | null {
  if (entityId <= 0 || !viewerHeroIds.length) return null;
  return viewerHeroIds.includes(entityId) ? entityId : null;
}

/** viewer 自身战力榜行：player_id 命中后取首将（列表顺序由调用方保证）。 */
export function pickViewerHeroIdForRankRow(viewerHeroIds: readonly number[]): number {
  for (const id of viewerHeroIds) {
    if (id > 0) return id;
  }
  return 0;
}

export function resolvePowerBoardHeroId(
  entityId: number,
  viewerPlayerId: number,
  viewerHeroIds: readonly number[],
): number | null {
  if (entityId <= 0 || viewerPlayerId <= 0) return null;
  const direct = rankPowerEntityMatchesViewerHero(entityId, viewerHeroIds);
  if (direct != null) return direct;
  if (entityId === viewerPlayerId) {
    const pick = pickViewerHeroIdForRankRow(viewerHeroIds);
    return pick > 0 ? pick : null;
  }
  return null;
}

function readEntryGrid(entry: LeaderboardEntryRow): { x: number; y: number } | null {
  const x = entry.grid_x ?? entry.city_x ?? entry.x;
  const y = entry.grid_y ?? entry.city_y ?? entry.y;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const gx = Number(x);
  const gy = Number(y);
  if (gx < 0 || gy < 0 || gx > 999 || gy > 999) return null;
  return { x: gx, y: gy };
}

/**
 * 排行表行 → 客户端深链意图（不发新 rank RPC）。
 * `viewerHeroIds` 可选：战力榜映射己方 hero_id 时使用；省略时仅判定 viewer 行结构（heroId=0 由 UI 拉列表后解析）。
 */
export function resolveRankRowDeepLink(
  board: number,
  entry: LeaderboardEntryRow,
  viewerPlayerId: number,
  viewerHeroIds: readonly number[] = [],
): RankRowDeepLink {
  const entityId = entry.entity_id ?? 0;
  if (board === LB_PLAYER_POWER) {
    const heroId = resolvePowerBoardHeroId(entityId, viewerPlayerId, viewerHeroIds);
    if (heroId != null && heroId > 0) return { kind: "hero", heroId };
    if (entityId > 0 && entityId === viewerPlayerId) {
      return { kind: "hero", heroId: 0 };
    }
    if (entityId > 0) {
      return { kind: "toast", message: RANK_HERO_VIEWER_ONLY_TOAST };
    }
    return { kind: "none" };
  }
  if (board === LB_PLAYER_RESOURCE) {
    if (entityId <= 0) return { kind: "none" };
    const grid = readEntryGrid(entry);
    if (grid) return { kind: "world-grid", gridX: grid.x, gridY: grid.y };
    if (viewerPlayerId > 0 && entityId === viewerPlayerId) {
      return { kind: "world-viewer" };
    }
    return { kind: "summary" };
  }
  return { kind: "none" };
}

export function formatRankReadonlySummary(
  board: number,
  entry: LeaderboardEntryRow,
): string {
  const rank = entry.rank ?? "?";
  const name = entry.display_name?.trim() || (entry.entity_id ? `玩家#${entry.entity_id}` : "?");
  const scoreLabel = leaderboardScoreLabel(board);
  const lines = [`${rank}. ${name}`, `${scoreLabel}：${entry.score ?? 0}`];
  const grid = readEntryGrid(entry);
  if (grid) lines.push(`格点：(${grid.x}, ${grid.y})`);
  const city = entry.city_name?.trim();
  if (city) lines.push(`城池：${city}`);
  return lines.join(" · ");
}
