import type { LeaderboardEntryRow } from "@/net/leaderboardFormat";
import { formatResourceAmount } from "@/net/hudFormat";
import { leaderboardTypeLabel } from "@/net/socialFormat";
import {
  formatLeaderboardRankDeltaLabel,
  leaderboardDensityScanScoreLabel,
} from "@/net/rankListDensityScanResidual";
import { formatRankListDensityScanResidualDeepestDeeperLine } from "@/net/rankListDensityScanResidualDeepestDeeper";

/** CLIENT-337：CLIENT-321 残余巩固再加深二层第六行下的只读 **巩固再加深三层** 第七行（CLIENT-184 **不退化**；**非** wave:52 双榜钉选主叙事）。 */
export const RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_CLASS =
  "rank-list-density-scan-residual-deepest-deepest-deeper-line";
export const RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_ROLE =
  "rank-list-density-scan-residual-deepest-deepest-deeper-line";

/**
 * 三甲密度残余巩固再加深二层行下的名次变化 + 战力/击杀分数只读 **巩固再加深三层** 扫读。
 */
export function formatRankListDensityScanResidualDeepestDeepestDeeperLine(
  boardType: number,
  entry: Pick<LeaderboardEntryRow, "rank" | "score">,
  previousRank?: number,
): string | null {
  const deeper = formatRankListDensityScanResidualDeepestDeeperLine(boardType, entry, previousRank);
  if (!deeper) return null;
  const currentRank = entry.rank ?? 0;
  const delta = formatLeaderboardRankDeltaLabel(previousRank, currentRank);
  const scoreLabel = leaderboardDensityScanScoreLabel(boardType);
  const scoreText = formatResourceAmount(entry.score);
  const rawScore = entry.score ?? 0;
  const board = leaderboardTypeLabel(boardType);
  return `扫读巩固再加深三层 · ${board} #${currentRank} · ${delta} · ${scoreLabel} ${scoreText}(${rawScore}) · 双榜密度 · 加深 ${deeper}`;
}

export function appendRankListDensityScanResidualDeepestDeepestDeeperSubline(
  cell: HTMLElement,
  line: string | null,
): void {
  cell
    .querySelector(`[data-role="${RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_ROLE}"]`)
    ?.remove();
  if (!line?.trim()) return;
  const sub = document.createElement("div");
  sub.className = RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_CLASS;
  sub.setAttribute("data-role", RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_ROLE);
  sub.textContent = line;
  cell.appendChild(sub);
}
