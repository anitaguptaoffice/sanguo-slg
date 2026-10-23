/** sessionStorage：最近一次成功出征的行军 id，用于军情列表扫读高亮（CLIENT-080）。 */
export const MARCH_HIGHLIGHT_SESSION_KEY = "march-highlight-id";

export const MARCH_HIGHLIGHT_TTL_MS = 60_000;

export const MARCH_ROW_RECENT_CLASS = "march-row-recent";

export type MarchHighlightState = {
  march_id: number;
  highlighted_at_ms: number;
};

export function parseMarchHighlightSessionValue(
  raw: string | null | undefined,
): MarchHighlightState | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed = JSON.parse(raw) as { march_id?: unknown; highlighted_at_ms?: unknown };
    const marchId = Number(parsed.march_id);
    const at = Number(parsed.highlighted_at_ms);
    if (!Number.isFinite(marchId) || marchId <= 0) return null;
    if (!Number.isFinite(at) || at < 0) return null;
    return { march_id: Math.trunc(marchId), highlighted_at_ms: Math.trunc(at) };
  } catch {
    return null;
  }
}

export function isMarchHighlightActive(
  state: MarchHighlightState,
  nowMs: number,
  ttlMs: number = MARCH_HIGHLIGHT_TTL_MS,
): boolean {
  return nowMs - state.highlighted_at_ms < ttlMs;
}

export function readMarchHighlightSession(
  nowMs: number,
  storage: Pick<Storage, "getItem" | "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
  ttlMs: number = MARCH_HIGHLIGHT_TTL_MS,
): MarchHighlightState | null {
  try {
    const parsed = parseMarchHighlightSessionValue(storage?.getItem(MARCH_HIGHLIGHT_SESSION_KEY) ?? null);
    if (!parsed) return null;
    if (!isMarchHighlightActive(parsed, nowMs, ttlMs)) {
      storage?.removeItem(MARCH_HIGHLIGHT_SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeMarchHighlightSession(
  marchId: number,
  highlightedAtMs: number,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  if (!Number.isFinite(marchId) || marchId <= 0) return;
  if (!Number.isFinite(highlightedAtMs)) return;
  const state: MarchHighlightState = {
    march_id: Math.trunc(marchId),
    highlighted_at_ms: Math.trunc(highlightedAtMs),
  };
  try {
    storage?.setItem(MARCH_HIGHLIGHT_SESSION_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

export function clearMarchHighlightSession(
  storage: Pick<Storage, "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.removeItem(MARCH_HIGHLIGHT_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function marchRowShouldBeRecent(
  marchId: number | null | undefined,
  state: MarchHighlightState | null,
  nowMs: number,
  ttlMs: number = MARCH_HIGHLIGHT_TTL_MS,
): boolean {
  if (marchId == null || state == null) return false;
  if (state.march_id !== marchId) return false;
  return isMarchHighlightActive(state, nowMs, ttlMs);
}

/** 用户选中军情行：选中非高亮行时清除 session 高亮。 */
export function resolveMarchHighlightOnRowSelect(
  selectedMarchId: number | null,
  state: MarchHighlightState | null,
  nowMs: number,
  ttlMs: number = MARCH_HIGHLIGHT_TTL_MS,
): MarchHighlightState | null {
  if (state == null) return null;
  if (!isMarchHighlightActive(state, nowMs, ttlMs)) return null;
  if (selectedMarchId == null) return state;
  if (selectedMarchId === state.march_id) return state;
  return null;
}

export function remainingMarchHighlightMs(
  state: MarchHighlightState,
  nowMs: number,
  ttlMs: number = MARCH_HIGHLIGHT_TTL_MS,
): number {
  return Math.max(0, ttlMs - (nowMs - state.highlighted_at_ms));
}
