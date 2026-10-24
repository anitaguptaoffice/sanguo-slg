import type { MarchSummary } from "@/net/militaryFormat";
import { findFirstMarchByDest } from "@/ui/worldMinimap";

/** 军情列表选中 → 小地图目的格 1.5s 焦点环（CLIENT-220；canvas + `#layout-frame` 钩子）。 */
export const MINIMAP_INTEL_SYNC_RING_CLASS = "minimap-intel-sync-ring";

/** 小地图/格点信息卡 → 军情列表同源 `march_id` 行高亮（CLIENT-220）。 */
export const INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_CLASS = "intel-row-minimap-sync-highlight";

export const MINIMAP_INTEL_SYNC_RING_MS = 1500;
export const INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_MS = 1500;

export const MINIMAP_INTEL_SYNC_RING_COLOR = "#9cdcfe";

export type MinimapIntelSyncRingState = {
  wx: number;
  wy: number;
  untilMs: number;
};

export type MinimapIntelSyncTimers = {
  syncRingClassTimer: ReturnType<typeof setTimeout> | null;
  rowHighlightTimer: ReturnType<typeof setTimeout> | null;
};

export function createMinimapIntelSyncTimers(): MinimapIntelSyncTimers {
  return { syncRingClassTimer: null, rowHighlightTimer: null };
}

export function isMinimapIntelSyncRingActive(untilMs: number, nowMs: number): boolean {
  return untilMs > nowMs;
}

/** 格点上的首条进行中行军（与 `selectMarchByDest` 同源）。 */
export function resolveMarchIdForMinimapIntelTile(
  marches: MarchSummary[],
  wx: number,
  wy: number,
): number | null {
  if (!Number.isFinite(wx) || !Number.isFinite(wy)) return null;
  const match = findFirstMarchByDest(marches, Math.trunc(wx), Math.trunc(wy));
  const id = match?.march_id;
  if (id == null || !Number.isFinite(id) || id <= 0) return null;
  return Math.trunc(id);
}

function clearIntelRowMinimapSyncHighlight(intelRoot: ParentNode | null | undefined): void {
  if (!intelRoot) return;
  intelRoot
    .querySelectorAll<HTMLElement>(`.${INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_CLASS}`)
    .forEach((row) => row.classList.remove(INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_CLASS));
}

export type HighlightIntelRowForMinimapTileOptions = {
  marchId?: number | null;
  durationMs?: number;
  timers?: MinimapIntelSyncTimers;
};

/**
 * 小地图选点或格点信息卡打开军情时：高亮列表同源 `march_id` 行并滚动入视口。
 * @returns 高亮的 `march_id`，无匹配时 `null`。
 */
export function highlightIntelRowForMinimapTile(
  intelRoot: ParentNode | null | undefined,
  marches: MarchSummary[],
  wx: number,
  wy: number,
  options?: HighlightIntelRowForMinimapTileOptions,
): number | null {
  const timers = options?.timers;
  if (timers?.rowHighlightTimer) {
    clearTimeout(timers.rowHighlightTimer);
    timers.rowHighlightTimer = null;
  }
  clearIntelRowMinimapSyncHighlight(intelRoot);

  let marchId = options?.marchId ?? null;
  if (marchId != null && Number.isFinite(marchId)) {
    marchId = Math.trunc(marchId);
  } else {
    marchId = resolveMarchIdForMinimapIntelTile(marches, wx, wy);
  }
  if (marchId == null || !intelRoot) return null;

  const li = intelRoot.querySelector<HTMLElement>(
    `.march-list li[data-march-id="${marchId}"]`,
  );
  if (!li) return marchId;

  li.classList.add(INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_CLASS);
  li.scrollIntoView?.({ block: "nearest" });

  const duration = options?.durationMs ?? INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_MS;
  if (timers && duration > 0) {
    timers.rowHighlightTimer = setTimeout(() => {
      timers.rowHighlightTimer = null;
      li.classList.remove(INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_CLASS);
    }, duration);
  }

  return marchId;
}

function clearMinimapIntelSyncRingClass(
  layoutFrame: HTMLElement | null | undefined,
): void {
  layoutFrame?.classList.remove(MINIMAP_INTEL_SYNC_RING_CLASS);
}

export type BeginMinimapIntelSyncRingOptions = {
  durationMs?: number;
  timers?: MinimapIntelSyncTimers;
  nowMs?: number;
};

/** 军情列表选中行军：启动小地图目的格 sync 环状态（供 canvas 绘制 + layout-frame class）。 */
export function beginMinimapIntelSyncRing(
  wx: number,
  wy: number,
  layoutFrame: HTMLElement | null | undefined,
  options?: BeginMinimapIntelSyncRingOptions,
): MinimapIntelSyncRingState | null {
  if (!Number.isFinite(wx) || !Number.isFinite(wy)) return null;
  const duration = options?.durationMs ?? MINIMAP_INTEL_SYNC_RING_MS;
  const nowMs = options?.nowMs ?? Date.now();
  const timers = options?.timers;

  if (timers?.syncRingClassTimer) {
    clearTimeout(timers.syncRingClassTimer);
    timers.syncRingClassTimer = null;
  }
  clearMinimapIntelSyncRingClass(layoutFrame);
  if (layoutFrame) {
    layoutFrame.classList.add(MINIMAP_INTEL_SYNC_RING_CLASS);
    void layoutFrame.offsetWidth;
  }
  if (timers && layoutFrame && duration > 0) {
    timers.syncRingClassTimer = setTimeout(() => {
      timers.syncRingClassTimer = null;
      clearMinimapIntelSyncRingClass(layoutFrame);
    }, duration);
  }

  return {
    wx: Math.trunc(wx),
    wy: Math.trunc(wy),
    untilMs: nowMs + duration,
  };
}

/** 军情 `MarchSummary` 选中 → 小地图 sync 环（无坐标时跳过）。 */
export function beginMinimapIntelSyncRingForMarch(
  march: Pick<MarchSummary, "to_x" | "to_y"> | null | undefined,
  layoutFrame: HTMLElement | null | undefined,
  options?: BeginMinimapIntelSyncRingOptions,
): MinimapIntelSyncRingState | null {
  if (!march) return null;
  const tx = march.to_x;
  const ty = march.to_y;
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return null;
  return beginMinimapIntelSyncRing(tx!, ty!, layoutFrame, options);
}

/** @internal vitest */
export function resetMinimapIntelSyncTimersForTests(timers: MinimapIntelSyncTimers): void {
  if (timers.syncRingClassTimer) {
    clearTimeout(timers.syncRingClassTimer);
    timers.syncRingClassTimer = null;
  }
  if (timers.rowHighlightTimer) {
    clearTimeout(timers.rowHighlightTimer);
    timers.rowHighlightTimer = null;
  }
}
