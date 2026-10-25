import {
  clearMarchHighlightSession,
  MARCH_HIGHLIGHT_SESSION_KEY,
  type MarchHighlightState,
} from "@/net/marchHighlight";

/**
 * sessionStorage 并存规则（CLIENT-090）：
 * - `march-highlight-id`（CLIENT-080）：出征成功后的扫读高亮，带 TTL，仅影响 `march-row-recent`。
 * - `minimap-march-focus-id`（本模块）：小地图↔军情列表双向选中的 `march_id`，无 TTL，仅影响
 *   `march-list-row-selected` 与小地图 `selectedMarchId` 目的格高亮。
 * 两键互不清除、互不写；格点筛选（CLIENT-069）只读列表快照，不读 focus 键。
 */
export const MINIMAP_MARCH_FOCUS_SESSION_KEY = "minimap-march-focus-id";

export function parseMinimapMarchFocusId(
  raw: string | null | undefined,
): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

export function readMinimapMarchFocusSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): number | null {
  try {
    return parseMinimapMarchFocusId(
      storage?.getItem(MINIMAP_MARCH_FOCUS_SESSION_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

export function writeMinimapMarchFocusSession(
  marchId: number,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  if (!Number.isFinite(marchId) || marchId <= 0) return;
  try {
    storage?.setItem(MINIMAP_MARCH_FOCUS_SESSION_KEY, String(Math.trunc(marchId)));
  } catch {
    /* quota / private mode */
  }
}

export function clearMinimapMarchFocusSession(
  storage: Pick<Storage, "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.removeItem(MINIMAP_MARCH_FOCUS_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** 写入小地图/列表焦点：不修改 `march-highlight-id`。 */
export function syncMinimapMarchFocusSession(
  marchId: number | null,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null =
    typeof sessionStorage !== "undefined" ? sessionStorage : null,
): void {
  if (marchId == null) {
    clearMinimapMarchFocusSession(storage);
    return;
  }
  writeMinimapMarchFocusSession(marchId, storage);
}

/** 纯函数：两 session 键是否应独立保留（用于单测与文档）。 */
export function marchFocusAndHighlightSessionsCoexist(
  focusMarchId: number | null,
  highlight: MarchHighlightState | null,
): { focusKey: string | null; highlightKey: string | null } {
  return {
    focusKey: focusMarchId != null ? String(focusMarchId) : null,
    highlightKey:
      highlight != null
        ? JSON.stringify({
            march_id: highlight.march_id,
            highlighted_at_ms: highlight.highlighted_at_ms,
          })
        : null,
  };
}

/** 写入 focus 后 highlight 键仍应可读（并存，不互删）。 */
export function writeMinimapFocusPreservesMarchHighlight(
  marchId: number,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
): boolean {
  const before = storage.getItem(MARCH_HIGHLIGHT_SESSION_KEY);
  writeMinimapMarchFocusSession(marchId, storage);
  return storage.getItem(MARCH_HIGHLIGHT_SESSION_KEY) === before;
}

/** 清除 CLIENT-080 高亮时不应清除小地图焦点。 */
export function clearMarchHighlightPreservesMinimapFocus(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
): boolean {
  const before = storage.getItem(MINIMAP_MARCH_FOCUS_SESSION_KEY);
  clearMarchHighlightSession(storage);
  return storage.getItem(MINIMAP_MARCH_FOCUS_SESSION_KEY) === before;
}
