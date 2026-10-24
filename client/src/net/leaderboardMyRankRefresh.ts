import { formatSocialPanelLastUpdated } from "@/net/socialRefreshFormat";

export const RANK_MY_RANK_CHANGED_PULSE_CLASS = "rank-my-rank-changed-pulse";
/** 我的排名变更钉选行脉冲时长（CLIENT-152 / 与军情 phase 脉冲同为 3s）。 */
export const RANK_MY_RANK_CHANGED_PULSE_MS = 3000;

/**
 * 相对上一轮同榜快照，判定 my_rank 是否变化（不含首次拉取）。
 */
export function detectLeaderboardMyRankChange(
  previousMyRank: number | undefined,
  nextMyRank: number | undefined,
): boolean {
  if (previousMyRank === undefined) return false;
  const prev = previousMyRank ?? 0;
  const next = nextMyRank ?? 0;
  return prev !== next;
}

/** 钉选行次行：上次手动刷新相对时间（CLIENT-144 formatter）。 */
export function formatMyRankPinSecondaryLine(lastRefreshMs: number, nowMs = Date.now()): string | null {
  if (!Number.isFinite(lastRefreshMs) || lastRefreshMs <= 0) return null;
  return formatSocialPanelLastUpdated(lastRefreshMs, nowMs);
}

export function scheduleRankMyRankChangedPulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  row.classList.remove(RANK_MY_RANK_CHANGED_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(RANK_MY_RANK_CHANGED_PULSE_CLASS);
  window.setTimeout(
    () => row.classList.remove(RANK_MY_RANK_CHANGED_PULSE_CLASS),
    RANK_MY_RANK_CHANGED_PULSE_MS,
  );
}
