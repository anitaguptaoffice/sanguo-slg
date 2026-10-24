
/** sessionStorage：双榜本会话手动刷新次数（CLIENT-264，按榜单类型分键；无新 rank RPC）。 */
export const RANK_MANUAL_REFRESH_COUNT_SESSION_KEY = "rank-manual-refresh-count";

export type RankManualRefreshCountMap = Partial<Record<number, number>>;

export function parseRankManualRefreshCountSession(
  raw: string | null | undefined,
): RankManualRefreshCountMap {
  if (raw == null || raw === "") return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: RankManualRefreshCountMap = {};
    for (const [k, v] of Object.entries(parsed)) {
      const type = Number(k);
      const count = Number(v);
      if (Number.isFinite(type) && type > 0 && Number.isFinite(count) && count > 0) {
        out[type] = Math.trunc(count);
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function readRankManualRefreshCount(
  boardType: number,
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): number {
  const map = parseRankManualRefreshCountSession(
    storage?.getItem(RANK_MANUAL_REFRESH_COUNT_SESSION_KEY) ?? null,
  );
  const n = map[boardType];
  return n != null && n > 0 ? n : 0;
}

function writeRankManualRefreshCountMap(
  map: RankManualRefreshCountMap,
  storage: Pick<Storage, "setItem"> | null,
): void {
  try {
    storage?.setItem(RANK_MANUAL_REFRESH_COUNT_SESSION_KEY, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

/** 手动刷新成功后递增（与 `rank-manual-refresh-ms` 同刻写入）。 */
export function incrementRankManualRefreshCount(
  boardType: number,
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): number {
  if (!Number.isFinite(boardType) || boardType <= 0) return 0;
  const map = parseRankManualRefreshCountSession(
    storage?.getItem(RANK_MANUAL_REFRESH_COUNT_SESSION_KEY) ?? null,
  );
  const next = (map[boardType] ?? 0) + 1;
  map[boardType] = next;
  writeRankManualRefreshCountMap(map, storage);
  return next;
}

/** 巩固次行手动刷新次数片段；0 次返回空字符串。 */
export function formatRankManualRefreshCountLine(count: number): string {
  const n = Math.trunc(count);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `手动刷新 ×${n}`;
}
