import {
  applyRankPanelScrollTop,
  readRankPanelScrollTop,
  type LeaderboardReturnScrollPayload,
} from "@/net/leaderboardReturnScroll";

/** sessionStorage：手动刷新排行后保持钉选行视口扫读（CLIENT-184）。 */
export const LEADERBOARD_PIN_SESSION_KEY = "leaderboard-pin-v1";

export type LeaderboardPinPayload = {
  boardType: number;
  scrollTop: number;
};

export function parseLeaderboardPinSession(
  raw: string | null | undefined,
): LeaderboardPinPayload | null {
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

export function readLeaderboardPin(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): LeaderboardPinPayload | null {
  try {
    return parseLeaderboardPinSession(storage?.getItem(LEADERBOARD_PIN_SESSION_KEY) ?? null);
  } catch {
    return null;
  }
}

export function writeLeaderboardPin(
  payload: LeaderboardPinPayload,
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
      LEADERBOARD_PIN_SESSION_KEY,
      JSON.stringify({ boardType: Math.trunc(boardType), scrollTop: Math.trunc(scrollTop) }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearLeaderboardPin(
  storage: Pick<Storage, "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.removeItem(LEADERBOARD_PIN_SESSION_KEY);
  } catch {
    /* quota / private mode */
  }
}

/** 刷新前写入当前榜 scrollTop，供刷新后恢复钉选行视口。 */
export function captureLeaderboardPinBeforeRefresh(
  rankPanel: HTMLElement,
  boardType: number,
  storage?: Pick<Storage, "setItem"> | null,
): void {
  writeLeaderboardPin({ boardType, scrollTop: readRankPanelScrollTop(rankPanel) }, storage);
}

/** 刷新渲染后恢复同榜 scrollTop；与 `leaderboard-return-scroll-v1` 互不覆盖。 */
export function applyLeaderboardPinAfterRefresh(
  rankPanel: HTMLElement,
  boardType: number,
  storage?: Pick<Storage, "getItem" | "removeItem"> | null,
): void {
  const pending = readLeaderboardPin(storage);
  if (!pending || pending.boardType !== boardType) return;
  clearLeaderboardPin(storage);
  applyRankPanelScrollTop(rankPanel, pending.scrollTop);
}

/** 将领深链返回时优先 return-scroll，勿与 pin 快照混用。 */
export function shouldDeferPinApplyForReturnScroll(
  returnScroll: LeaderboardReturnScrollPayload | null,
  boardType: number,
): boolean {
  return returnScroll != null && returnScroll.boardType === boardType;
}
