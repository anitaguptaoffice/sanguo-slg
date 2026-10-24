import type { MainCitySession } from "@/net/bootstrapSession";
import { formatResourceAmount } from "@/net/hudFormat";
import { formatSocialRankEmptyMessage, leaderboardTypeLabel } from "@/net/socialFormat";

/** 与 sanguo.rank.v1.LeaderboardType / rank_gateway 一致 */
export const LB_PLAYER_POWER = 1;
export const LB_PLAYER_RESOURCE = 2;

export type LeaderboardEntryRow = {
  rank?: number;
  entity_id?: number;
  /** 可选扩展：与 entity_id 同义的 player_id（快照字段，非新 rank proto）。 */
  player_id?: number;
  display_name?: string;
  score?: number;
  /** 可选扩展：行关联将领（快照字段，供 CLIENT-168 深链）。 */
  hero_id?: number;
  /** 可选扩展：资源榜行关联格点/城池（网关快照字段，非新 rank proto）。 */
  grid_x?: number;
  grid_y?: number;
  city_x?: number;
  city_y?: number;
  city_name?: string;
  x?: number;
  y?: number;
};

/** GetLeaderboard 响应（proto 字段名；batch_id 为可选扩展） */
export type LeaderboardPagePayload = {
  type?: number;
  entries?: LeaderboardEntryRow[];
  total_count?: number;
  my_rank?: number;
  my_score?: number;
  snapshot_version?: number;
  snapshot_refreshed_at_ms?: number;
  batch_id?: number;
};

export function leaderboardScoreLabel(type?: number): string {
  switch (type) {
    case LB_PLAYER_RESOURCE:
      return "资源总量";
    case LB_PLAYER_POWER:
      return "战力";
    default:
      return "分数";
  }
}

export function formatLeaderboardEntryLine(entry: LeaderboardEntryRow): string {
  const rank = entry.rank ?? "?";
  const name = entry.display_name?.trim() || (entry.entity_id ? `玩家#${entry.entity_id}` : "?");
  return `${rank}. ${name} · ${entry.score ?? 0}`;
}

/** 三甲行昵称简称上限（CLIENT-184 密度扫读）。 */
export const LEADERBOARD_TOP_DENSITY_NAME_MAX = 4;

export function abbreviateLeaderboardDisplayName(
  displayName: string,
  maxRunes = LEADERBOARD_TOP_DENSITY_NAME_MAX,
): string {
  const trimmed = displayName.trim();
  if (!trimmed) return "?";
  const runes = Array.from(trimmed);
  if (runes.length <= maxRunes) return trimmed;
  return `${runes.slice(0, maxRunes).join("")}…`;
}

function leaderboardEntryDisplayName(entry: LeaderboardEntryRow): string {
  const entityId = entry.entity_id ?? entry.player_id;
  return entry.display_name?.trim() || (entityId ? `玩家#${entityId}` : "?");
}

/** 头部三甲密度行：名次 + 简称 + 分数截断（CLIENT-184）。 */
export function formatLeaderboardTopDensityLine(entry: LeaderboardEntryRow): string {
  const rank = entry.rank ?? "?";
  const shortName = abbreviateLeaderboardDisplayName(leaderboardEntryDisplayName(entry));
  const scoreText = formatResourceAmount(entry.score);
  return `#${rank} ${shortName} ${scoreText}`;
}

/** 手动刷新后列表顶提示行；无三甲数据时返回 null。 */
export function formatLeaderboardRefreshedHint(
  boardType: number,
  topEntries: LeaderboardEntryRow[],
): string | null {
  const top3 = topEntries.filter((e) => (e.rank ?? 0) > 0).slice(0, 3);
  if (top3.length === 0) return null;
  const board = leaderboardTypeLabel(boardType);
  return `已刷新 · ${board}三甲快览`;
}

/** 取榜单头部最多三条（按 entries 顺序，供密度行渲染）。 */
export function leaderboardTopDensityEntries(entries: LeaderboardEntryRow[]): LeaderboardEntryRow[] {
  return entries.filter((e) => (e.rank ?? 0) > 0).slice(0, 3);
}

/** 空榜占位与 dev 无种子提示（CLIENT-030 / CLIENT-053 统一 socialFormat）。 */
export function formatLeaderboardEmptyHint(): string {
  return formatSocialRankEmptyMessage();
}

/** 当前查看者名次/分数（proto: my_rank / my_score） */
/** 列表钉选行文案（CLIENT-096）；未上榜时返回 null。 */
export function formatMyRankPinLine(
  myRank: number | undefined,
  myScore: number | undefined,
  boardKind: number,
): string | null {
  const rank = myRank ?? 0;
  if (rank <= 0) return null;
  const scoreLabel = leaderboardScoreLabel(boardKind);
  const score = myScore ?? 0;
  return `我的排名 #${rank} · ${scoreLabel} ${score}`;
}

export function formatViewerRankSummary(
  type: number,
  viewerRank?: number,
  viewerScore?: number,
  fallbackScore?: number,
): string {
  const board = leaderboardTypeLabel(type);
  const scoreLabel = leaderboardScoreLabel(type);
  const score = viewerScore ?? fallbackScore ?? 0;
  if (viewerRank && viewerRank > 0) {
    return `我的名次：第 ${viewerRank} 名 · ${scoreLabel} ${score}（${board}）`;
  }
  return `未上榜（${board}）· 我的${scoreLabel}：${score}`;
}

/** 快照批次摘要；无元数据时返回 null */
export function formatLeaderboardSnapshotMeta(
  payload: Pick<
    LeaderboardPagePayload,
    "batch_id" | "snapshot_version" | "snapshot_refreshed_at_ms"
  >,
  nowMs = Date.now(),
): string | null {
  const parts: string[] = [];
  const batch = payload.batch_id ?? payload.snapshot_version;
  if (batch != null && batch > 0) {
    parts.push(`快照批次 #${batch}`);
  }
  const at = payload.snapshot_refreshed_at_ms;
  if (at != null && at > 0) {
    const d = new Date(at);
    const rel = formatRelativeRefresh(at, nowMs);
    parts.push(`刷新于 ${d.toLocaleString("zh-CN")}${rel ? `（${rel}）` : ""}`);
  }
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

function formatRelativeRefresh(atMs: number, nowMs: number): string | null {
  const delta = nowMs - atMs;
  if (delta < 0) return null;
  const min = Math.floor(delta / 60_000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} 小时前`;
  return null;
}

export function selectedLeaderboardTypeFromValue(raw: string | number): number {
  const n = Number(raw);
  if (n === LB_PLAYER_RESOURCE) return LB_PLAYER_RESOURCE;
  return LB_PLAYER_POWER;
}

export function viewerScoreFallback(session: MainCitySession | null | undefined, type: number): number | undefined {
  if (!session) return undefined;
  if (type === LB_PLAYER_RESOURCE) {
    const w = session.wallet ?? {};
    return (w.food ?? 0) + (w.wood ?? 0) + (w.iron ?? 0) + (w.stone ?? 0) + (w.gold ?? 0);
  }
  return session.player?.power;
}
