import type { LeaderboardEntryRow } from "@/net/leaderboardFormat";
import { formatResourceAmount } from "@/net/hudFormat";
import { leaderboardTypeLabel } from "@/net/socialFormat";
import {
  formatLeaderboardRankDeltaLabel,
  formatRankListDensityScanResidualLine,
  leaderboardDensityScanScoreLabel,
} from "@/net/rankListDensityScanResidual";

/** CLIENT-273：CLIENT-257 残余次行下的只读 **加深** 第三行（CLIENT-184 **不退化**；**非** wave:44 钉选主叙事）。 */
export const RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEP_CLASS =
  "rank-list-density-scan-residual-deep-line";
export const RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEP_ROLE =
  "rank-list-density-scan-residual-deep-line";

/**
 * 三甲密度残余次行下的名次变化 + 战力/资源分数 **加深** 只读扫读第三行。
 */
export function formatRankListDensityScanResidualDeepLine(
  boardType: number,
  entry: Pick<LeaderboardEntryRow, "rank" | "score">,
  previousRank?: number,
): string | null {
  const residual = formatRankListDensityScanResidualLine(boardType, entry, previousRank);
  if (!residual) return null;
  const currentRank = entry.rank ?? 0;
  const delta = formatLeaderboardRankDeltaLabel(previousRank, currentRank);
  const scoreLabel = leaderboardDensityScanScoreLabel(boardType);
  const scoreText = formatResourceAmount(entry.score);
  const rawScore = entry.score ?? 0;
  const board = leaderboardTypeLabel(boardType);
  return `扫读加深 · ${board} #${currentRank} · ${delta} · ${scoreLabel} ${scoreText}(${rawScore}) · 残余 ${residual}`;
}

export function appendRankListDensityScanResidualDeepSubline(
  cell: HTMLElement,
  line: string | null,
): void {
  cell.querySelector(`[data-role="${RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEP_ROLE}"]`)?.remove();
  if (!line?.trim()) return;
  const sub = document.createElement("div");
  sub.className = RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEP_CLASS;
  sub.setAttribute("data-role", RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEP_ROLE);
  sub.textContent = line;
  cell.appendChild(sub);
}
