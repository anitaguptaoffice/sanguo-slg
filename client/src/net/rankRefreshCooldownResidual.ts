import { formatRankLastRefreshLine } from "@/net/rankLastRefreshSession";
import {
  formatRankRefreshCooldownStamp,
  rankRefreshCooldownRemainingMs,
  RANK_MANUAL_REFRESH_COOLDOWN_MS,
} from "@/net/rankRefreshCooldown";

/** CLIENT-248：双榜顶栏刷新冷却 + 上次刷新只读残余次行（CLIENT-214 主戳记不退化）。 */
export const RANK_REFRESH_COOLDOWN_RESIDUAL_STAMP_ROLE = "rank-refresh-cooldown-residual";
export const RANK_REFRESH_COOLDOWN_RESIDUAL_STAMP_CLASS = "rank-refresh-cooldown-residual-stamp";

/**
 * 手动刷新冷却窗口内：冷却剩余与上次刷新时间合并次行；冷却结束返回空字符串。
 */
export function formatRankRefreshCooldownResidualStamp(
  lastRefreshMs: number,
  lastManualRefreshMs: number,
  nowMs = Date.now(),
  cooldownMs = RANK_MANUAL_REFRESH_COOLDOWN_MS,
): string {
  if (rankRefreshCooldownRemainingMs(lastManualRefreshMs, nowMs, cooldownMs) <= 0) return "";
  const parts: string[] = [];
  const cooldown = formatRankRefreshCooldownStamp(lastManualRefreshMs, nowMs, cooldownMs);
  if (cooldown) parts.push(cooldown);
  const refreshLine = formatRankLastRefreshLine(lastRefreshMs, nowMs);
  if (refreshLine) parts.push(refreshLine);
  return parts.join(" · ");
}

export function syncRankRefreshCooldownResidualStamp(
  rankPanelRoot: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = rankPanelRoot?.querySelector<HTMLElement>(
    `[data-role="${RANK_REFRESH_COOLDOWN_RESIDUAL_STAMP_ROLE}"]`,
  );
  if (!el) return;
  if (!line?.trim()) {
    el.textContent = "";
    el.classList.add("hidden");
    return;
  }
  el.textContent = line;
  el.classList.remove("hidden");
}
