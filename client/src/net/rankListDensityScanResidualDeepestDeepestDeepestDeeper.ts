import type { LeaderboardEntryRow } from "@/net/leaderboardFormat";
import { formatResourceAmount } from "@/net/hudFormat";
import { leaderboardTypeLabel } from "@/net/socialFormat";
import {
  formatLeaderboardRankDeltaLabel,
  leaderboardDensityScanScoreLabel,
} from "@/net/rankListDensityScanResidual";
import { formatRankListDensityScanResidualDeepestDeepestDeepestLine } from "@/net/rankListDensityScanResidualDeepestDeepestDeepest";

/** CLIENT-369：CLIENT-353 残余巩固再加深四层第八行下的只读 **巩固再加深五层** 第九行（CLIENT-184 **不退化**；**非** wave:56 双榜钉选主叙事）。 */
export const RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_CLASS =
  "rank-list-density-scan-residual-deepest-deepest-deepest-deeper-line";
export const RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_ROLE =
  "rank-list-density-scan-residual-deepest-deepest-deepest-deeper-line";

/**
 * 三甲密度残余巩固再加深四层行下的名次变化 + 战力/击杀分数只读 **巩固再加深五层** 扫读。
 */
export function formatRankListDensityScanResidualDeepestDeepestDeepestDeeperLine(
  boardType: number,
  entry: Pick<LeaderboardEntryRow, "rank" | "score">,
  previousRank?: number,
): string | null {
  const deepestDeepestDeepest = formatRankListDensityScanResidualDeepestDeepestDeepestLine(
    boardType,
    entry,
    previousRank,
  );
  if (!deepestDeepestDeepest) return null;
  const currentRank = entry.rank ?? 0;
  const delta = formatLeaderboardRankDeltaLabel(previousRank, currentRank);
  const scoreLabel = leaderboardDensityScanScoreLabel(boardType);
  const scoreText = formatResourceAmount(entry.score);
  const rawScore = entry.score ?? 0;
  const board = leaderboardTypeLabel(boardType);
  return `扫读巩固再加深五层 · ${board} #${currentRank} · ${delta} · ${scoreLabel} ${scoreText}(${rawScore}) · 双榜密度 · 加深 ${deepestDeepestDeepest}`;
}

export function appendRankListDensityScanResidualDeepestDeepestDeepestDeeperSubline(
  cell: HTMLElement,
  line: string | null,
): void {
  cell
    .querySelector(
      `[data-role="${RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_ROLE}"]`,
    )
    ?.remove();
  if (!line?.trim()) return;
  const sub = document.createElement("div");
  sub.className = RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_CLASS;
  sub.setAttribute("data-role", RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_ROLE);
  sub.textContent = line;
  cell.appendChild(sub);
}
