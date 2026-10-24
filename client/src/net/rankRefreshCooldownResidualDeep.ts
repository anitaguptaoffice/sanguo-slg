import { formatRankManualRefreshCountLine } from "@/net/rankManualRefreshCountSession";
import { formatRankRefreshCooldownResidualStamp } from "@/net/rankRefreshCooldownResidual";
import {
  rankRefreshCooldownRemainingMs,
  RANK_MANUAL_REFRESH_COOLDOWN_MS,
} from "@/net/rankRefreshCooldown";

/** CLIENT-264：双榜顶栏冷却 + 上次刷新 + 手动次数只读巩固次行（CLIENT-248/214 不退化）。 */
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEP_STAMP_ROLE = "rank-refresh-cooldown-residual-deep";
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEP_STAMP_CLASS =
  "rank-refresh-cooldown-residual-deep-stamp";

/**
 * 冷却窗口内：在 CLIENT-248 残余次行基础上追加本会话手动刷新次数；冷却结束返回空字符串。
 */
export function formatRankRefreshCooldownResidualDeepStamp(
  lastRefreshMs: number,
  lastManualRefreshMs: number,
  manualRefreshCount: number,
  nowMs = Date.now(),
  cooldownMs = RANK_MANUAL_REFRESH_COOLDOWN_MS,
): string {
  if (rankRefreshCooldownRemainingMs(lastManualRefreshMs, nowMs, cooldownMs) <= 0) return "";
  const parts: string[] = [];
  const residual = formatRankRefreshCooldownResidualStamp(
    lastRefreshMs,
    lastManualRefreshMs,
    nowMs,
    cooldownMs,
  );
  if (residual) parts.push(residual);
  const countLine = formatRankManualRefreshCountLine(manualRefreshCount);
  if (countLine) parts.push(countLine);
  return parts.join(" · ");
}

export function syncRankRefreshCooldownResidualDeepStamp(
  rankPanelRoot: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = rankPanelRoot?.querySelector<HTMLElement>(
    `[data-role="${RANK_REFRESH_COOLDOWN_RESIDUAL_DEEP_STAMP_ROLE}"]`,
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
