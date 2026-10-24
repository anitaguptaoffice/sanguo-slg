/** sessionStorage：从将领详情返回排行时恢复 tab + scrollTop（CLIENT-168）。 */
export const LEADERBOARD_RETURN_SCROLL_SESSION_KEY = "leaderboard-return-scroll-v1";

export type LeaderboardReturnScrollPayload = {
  boardType: number;
  scrollTop: number;
};

export function parseLeaderboardReturnScrollSession(
  raw: string | null | undefined,
): LeaderboardReturnScrollPayload | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed = JSON.parse(raw) as { boardType?: unknown; scrollTop?: unknown };
    const boardType = Number(parsed.boardType);
    const scrollTop = Number(parsed.scrollTop);
    if (!Number.isFinite(boardType) || boardType <= 0) return null;
    if (!Number.isFinite(scrollTop) || scrollTop < 0) return null;
    return { boardType: Math.trunc(boardType), scrollTop: Math.trunc(scrollTop) };
  } catch {
    return null;
  }
}

export function readLeaderboardReturnScroll(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): LeaderboardReturnScrollPayload | null {
  try {
    return parseLeaderboardReturnScrollSession(
      storage?.getItem(LEADERBOARD_RETURN_SCROLL_SESSION_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

export function writeLeaderboardReturnScroll(
  payload: LeaderboardReturnScrollPayload,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  const boardType = Number(payload.boardType);
  const scrollTop = Number(payload.scrollTop);
  if (!Number.isFinite(boardType) || boardType <= 0 || !Number.isFinite(scrollTop) || scrollTop < 0) {
    return;
  }
  try {
    storage?.setItem(
      LEADERBOARD_RETURN_SCROLL_SESSION_KEY,
      JSON.stringify({ boardType: Math.trunc(boardType), scrollTop: Math.trunc(scrollTop) }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearLeaderboardReturnScroll(
  storage: Pick<Storage, "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.removeItem(LEADERBOARD_RETURN_SCROLL_SESSION_KEY);
  } catch {
    /* quota / private mode */
  }
}

/** 排行面板主滚动容器：宽屏为 `.rank-table-scroll`，窄屏为 `.panel-scroll-body`。 */
export function rankPanelPrimaryScrollEl(rankPanel: HTMLElement): HTMLElement | null {
  const tableScroll = rankPanel.querySelector<HTMLElement>(".rank-table-scroll");
  if (tableScroll && tableScroll.scrollHeight > tableScroll.clientHeight) return tableScroll;
  const body = rankPanel.querySelector<HTMLElement>('[data-role="rank-scroll"]');
  return body ?? tableScroll;
}

export function readRankPanelScrollTop(rankPanel: HTMLElement): number {
  return rankPanelPrimaryScrollEl(rankPanel)?.scrollTop ?? 0;
}

export function applyRankPanelScrollTop(rankPanel: HTMLElement, scrollTop: number): void {
  const el = rankPanelPrimaryScrollEl(rankPanel);
  if (!el || !Number.isFinite(scrollTop) || scrollTop < 0) return;
  el.scrollTop = scrollTop;
}
