import {
  LB_PLAYER_POWER,
  LB_PLAYER_RESOURCE,
  type LeaderboardEntryRow,
} from "@/net/leaderboardFormat";
import { formatResourceAmount } from "@/net/hudFormat";

/** CLIENT-257：三甲密度行下只读扫读残余次行（CLIENT-184 主行 **不退化**；**非** wave:42 钉选 ring 主叙事）。 */
export const RANK_LIST_DENSITY_SCAN_RESIDUAL_CLASS = "rank-list-density-scan-residual-line";
export const RANK_LIST_DENSITY_SCAN_RESIDUAL_ROLE = "rank-list-density-scan-residual-line";

/** 双榜分数维度短标签（战力榜 / 资源榜扫读）。 */
export function leaderboardDensityScanScoreLabel(boardType: number): string {
  switch (boardType) {
    case LB_PLAYER_RESOURCE:
      return "资源";
    case LB_PLAYER_POWER:
    default:
      return "战力";
  }
}

/** 相对上一轮快照的名次变化文案（名次越小越好）。 */
export function formatLeaderboardRankDeltaLabel(
  previousRank: number | undefined,
  currentRank: number,
): string {
  const prev = previousRank ?? 0;
  if (prev <= 0) return "名次 新入三甲";
  if (prev === currentRank) return "名次 持平";
  const delta = prev - currentRank;
  if (delta > 0) return `名次 ↑${delta}`;
  return `名次 ↓${Math.abs(delta)}`;
}

export function leaderboardEntryEntityKey(entry: LeaderboardEntryRow): number {
  return entry.entity_id ?? entry.player_id ?? 0;
}

/** 在上一轮 entries 中按 entity 匹配历史名次。 */
export function lookupPreviousLeaderboardRank(
  previousEntries: LeaderboardEntryRow[],
  entry: LeaderboardEntryRow,
): number | undefined {
  const key = leaderboardEntryEntityKey(entry);
  if (key > 0) {
    const found = previousEntries.find((e) => leaderboardEntryEntityKey(e) === key);
    const rank = found?.rank ?? 0;
    if (rank > 0) return rank;
  }
  const atSlot = previousEntries.find((e) => e.rank === entry.rank);
  const slotRank = atSlot?.rank ?? 0;
  return slotRank > 0 ? slotRank : undefined;
}

/**
 * 密度列表行残余次行：名次变化 + 战力/资源分数只读扫读。
 */
export function formatRankListDensityScanResidualLine(
  boardType: number,
  entry: Pick<LeaderboardEntryRow, "rank" | "score">,
  previousRank?: number,
): string | null {
  const currentRank = entry.rank ?? 0;
  if (currentRank <= 0) return null;
  const delta = formatLeaderboardRankDeltaLabel(previousRank, currentRank);
  const scoreLabel = leaderboardDensityScanScoreLabel(boardType);
  const scoreText = formatResourceAmount(entry.score);
  return `密度扫读 · ${delta} · ${scoreLabel} ${scoreText}`;
}

export function appendRankListDensityScanResidualSubline(
  cell: HTMLElement,
  line: string | null,
): void {
  cell.querySelector(`[data-role="${RANK_LIST_DENSITY_SCAN_RESIDUAL_ROLE}"]`)?.remove();
  if (!line?.trim()) return;
  const sub = document.createElement("div");
  sub.className = RANK_LIST_DENSITY_SCAN_RESIDUAL_CLASS;
  sub.setAttribute("data-role", RANK_LIST_DENSITY_SCAN_RESIDUAL_ROLE);
  sub.textContent = line;
  cell.appendChild(sub);
}
