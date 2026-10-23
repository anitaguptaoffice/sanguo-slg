import type { MainCitySession } from "@/net/bootstrapSession";
import { leaderboardTypeLabel } from "@/net/socialFormat";

/** 与 sanguo.rank.v1.LeaderboardType / rank_gateway 一致 */
export const LB_PLAYER_POWER = 1;
export const LB_PLAYER_RESOURCE = 2;

export type LeaderboardEntryRow = {
  rank?: number;
  entity_id?: number;
  display_name?: string;
  score?: number;
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

/** 当前查看者名次/分数（proto: my_rank / my_score） */
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
