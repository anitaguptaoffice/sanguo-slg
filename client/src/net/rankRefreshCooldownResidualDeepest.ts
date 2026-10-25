import { formatRankLastRefreshLine } from "@/net/rankLastRefreshSession";
import { formatRankManualRefreshCountLine } from "@/net/rankManualRefreshCountSession";
import {
  formatRankRefreshCooldownStamp,
  rankRefreshCooldownRemainingMs,
  RANK_MANUAL_REFRESH_COOLDOWN_MS,
} from "@/net/rankRefreshCooldown";
import { formatRankRefreshCooldownResidualDeeperStamp } from "@/net/rankRefreshCooldownResidualDeeper";

/** CLIENT-296：双榜顶栏冷却 + 上次刷新 + 手动次数只读巩固再加深一层第三行（CLIENT-280/214 不退化）。 */
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_STAMP_ROLE =
  "rank-refresh-cooldown-residual-deepest";
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_STAMP_CLASS =
  "rank-refresh-cooldown-residual-deepest-stamp";

/**
 * 手动刷新冷却窗口内：在 CLIENT-280 再加深第三行之上追加只读 **巩固再加深一层** 第三行；冷却结束返回空字符串。
 */
export function formatRankRefreshCooldownResidualDeepestStamp(
  lastRefreshMs: number,
  lastManualRefreshMs: number,
  manualRefreshCount: number,
  nowMs = Date.now(),
  cooldownMs = RANK_MANUAL_REFRESH_COOLDOWN_MS,
): string {
  const remaining = rankRefreshCooldownRemainingMs(lastManualRefreshMs, nowMs, cooldownMs);
  if (remaining <= 0) return "";

  const deeper = formatRankRefreshCooldownResidualDeeperStamp(
    lastRefreshMs,
    lastManualRefreshMs,
    manualRefreshCount,
    nowMs,
    cooldownMs,
  );
  if (!deeper) return "";

  const elapsed = cooldownMs - remaining;
  const windowPct = Math.min(100, Math.max(0, Math.round((elapsed / cooldownMs) * 100)));

  const parts: string[] = [`巩固再加深一层 · 冷却窗 ${windowPct}%`];
  const cooldown = formatRankRefreshCooldownStamp(lastManualRefreshMs, nowMs, cooldownMs);
  if (cooldown) parts.push(cooldown);
  const refreshLine = formatRankLastRefreshLine(lastRefreshMs, nowMs);
  if (refreshLine) parts.push(refreshLine);
  const countLine = formatRankManualRefreshCountLine(manualRefreshCount);
  if (countLine) parts.push(countLine);
  parts.push("钉选保持扫读");
  parts.push(`巩固 ${deeper}`);
  return parts.join(" · ");
}

export function syncRankRefreshCooldownResidualDeepestStamp(
  rankPanelRoot: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = rankPanelRoot?.querySelector<HTMLElement>(
    `[data-role="${RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_STAMP_ROLE}"]`,
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
