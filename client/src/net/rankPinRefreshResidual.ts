import { formatMyRankPinSecondaryLine } from "@/net/leaderboardMyRankRefresh";
import { formatRankRefreshCooldownStamp } from "@/net/rankRefreshCooldown";

/** CLIENT-242：双榜顶栏钉选与刷新冷却只读残余次行。 */
export const RANK_PIN_REFRESH_RESIDUAL_ROLE = "rank-pin-refresh-residual-line";
export const RANK_PIN_REFRESH_RESIDUAL_CLASS = "rank-pin-refresh-residual-line";

/**
 * 上榜时顶栏残余扫读：钉选名次 + 上次刷新 + 手动刷新冷却（CLIENT-152/214 **不退化**）。
 */
export function formatRankPinRefreshResidualLine(
  myRank: number | undefined,
  lastRefreshMs: number,
  lastManualRefreshMs: number,
  nowMs = Date.now(),
): string | null {
  const rank = myRank ?? 0;
  if (rank <= 0) return null;
  const parts: string[] = [`钉选 #${rank}`];
  const refreshLine = formatMyRankPinSecondaryLine(lastRefreshMs, nowMs);
  if (refreshLine) parts.push(refreshLine);
  const cooldown = formatRankRefreshCooldownStamp(lastManualRefreshMs, nowMs);
  if (cooldown) parts.push(cooldown);
  return parts.join(" · ");
}

export function syncRankPinRefreshResidualLine(
  rankPanelRoot: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = rankPanelRoot?.querySelector<HTMLElement>(
    `[data-role="${RANK_PIN_REFRESH_RESIDUAL_ROLE}"]`,
  );
  if (!el) return;
  if (!line) {
    el.textContent = "";
    el.hidden = true;
    return;
  }
  el.textContent = line;
  el.hidden = false;
}
