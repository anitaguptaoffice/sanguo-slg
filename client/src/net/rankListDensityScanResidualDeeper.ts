import type { LeaderboardEntryRow } from "@/net/leaderboardFormat";
import { formatResourceAmount } from "@/net/hudFormat";
import { leaderboardTypeLabel } from "@/net/socialFormat";
import {
  formatLeaderboardRankDeltaLabel,
  leaderboardDensityScanScoreLabel,
} from "@/net/rankListDensityScanResidual";
import { formatRankListDensityScanResidualDeepLine } from "@/net/rankListDensityScanResidualDeep";

/** CLIENT-289：CLIENT-273 残余加深第三行下的只读 **巩固再加深** 第四行（CLIENT-184 **不退化**；**非** wave:46 双榜钉选主叙事）。 */
export const RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPER_CLASS =
  "rank-list-density-scan-residual-deeper-line";
export const RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPER_ROLE =
  "rank-list-density-scan-residual-deeper-line";

/**
 * 三甲密度残余加深行下的名次变化 + 战力/资源分数只读 **巩固再加深** 第四行扫读。
 */
export function formatRankListDensityScanResidualDeeperLine(
  boardType: number,
  entry: Pick<LeaderboardEntryRow, "rank" | "score">,
  previousRank?: number,
): string | null {
  const deep = formatRankListDensityScanResidualDeepLine(boardType, entry, previousRank);
  if (!deep) return null;
  const currentRank = entry.rank ?? 0;
  const delta = formatLeaderboardRankDeltaLabel(previousRank, currentRank);
  const scoreLabel = leaderboardDensityScanScoreLabel(boardType);
  const scoreText = formatResourceAmount(entry.score);
  const rawScore = entry.score ?? 0;
  const board = leaderboardTypeLabel(boardType);
  return `扫读巩固再加深 · ${board} #${currentRank} · ${delta} · ${scoreLabel} ${scoreText}(${rawScore}) · 双榜密度 · 加深 ${deep}`;
}

export function appendRankListDensityScanResidualDeeperSubline(
  cell: HTMLElement,
  line: string | null,
): void {
  cell.querySelector(`[data-role="${RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPER_ROLE}"]`)?.remove();
  if (!line?.trim()) return;
  const sub = document.createElement("div");
  sub.className = RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPER_CLASS;
  sub.setAttribute("data-role", RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPER_ROLE);
  sub.textContent = line;
  cell.appendChild(sub);
}
