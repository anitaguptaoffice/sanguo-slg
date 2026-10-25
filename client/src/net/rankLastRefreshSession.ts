import { formatPanelRefreshStamp } from "@/net/panelRefreshStamp";

/** sessionStorage：双榜手动刷新成功时刻（CLIENT-096，按榜单类型分键）。 */
export const RANK_LAST_REFRESH_SESSION_KEY = "rank-last-refresh-ms";

export type RankLastRefreshMap = Partial<Record<number, number>>;

export function parseRankLastRefreshSession(raw: string | null | undefined): RankLastRefreshMap {
  if (raw == null || raw === "") return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: RankLastRefreshMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      const type = Number(k);
      const ms = Number(v);
      if (Number.isFinite(type) && type > 0 && Number.isFinite(ms) && ms > 0) {
        out[type] = ms;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function readRankLastRefreshMs(
  boardType: number,
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): number {
  const map = parseRankLastRefreshSession(storage?.getItem(RANK_LAST_REFRESH_SESSION_KEY) ?? null);
  const ms = map[boardType];
  return ms != null && ms > 0 ? ms : 0;
}

export function writeRankLastRefreshMs(
  boardType: number,
  atMs: number,
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  if (!Number.isFinite(atMs) || atMs <= 0 || !Number.isFinite(boardType) || boardType <= 0) return;
  try {
    const map = parseRankLastRefreshSession(storage?.getItem(RANK_LAST_REFRESH_SESSION_KEY) ?? null);
    map[boardType] = Math.trunc(atMs);
    storage?.setItem(RANK_LAST_REFRESH_SESSION_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

/** 排行顶栏「上次刷新」戳记（与军团/聊天共用 formatter，CLIENT-144）。 */
export function formatRankLastRefreshLine(atMs: number, nowMs = Date.now()): string {
  return formatPanelRefreshStamp(atMs, nowMs);
}
