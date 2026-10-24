import type { MarchSummary } from "@/net/militaryFormat";
import { panelScrollBody } from "@/ui/contentPanelScroll";
import {
  computeMinimapViewFramingPoints,
  findFirstMarchByDest,
  findMarchIdForMinimapDestClick,
  minimapLayoutToWorld,
  type MinimapLayoutRect,
  type MinimapView,
  type WorldBounds,
} from "@/ui/worldMinimap";

/** sessionStorage：军情选中行对应的小地图视口锚点（CLIENT-236）。 */
export const MINIMAP_VIEWPORT_INTEL_ANCHOR_SESSION_KEY = "minimap-viewport-intel-anchor-v1";

/** 军情选中 → 小地图视口平移后的 layout-frame 脉冲（与 CLIENT-220 `minimap-intel-sync-ring` 并存）。 */
export const MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS = "minimap-viewport-intel-sync-ring";

export const MINIMAP_VIEWPORT_INTEL_SYNC_RING_MS = 1200;

export type MinimapViewportIntelAnchorPayload = {
  marchId: number;
  toX: number;
  toY: number;
  zoom: number;
  panWx: number;
  panWy: number;
};

export type MinimapViewportIntelSyncTimers = {
  viewportRingClassTimer: ReturnType<typeof setTimeout> | null;
};

export function createMinimapViewportIntelSyncTimers(): MinimapViewportIntelSyncTimers {
  return { viewportRingClassTimer: null };
}

export function serializeMinimapViewportIntelAnchor(
  payload: MinimapViewportIntelAnchorPayload,
): string {
  return JSON.stringify({
    marchId: Math.trunc(payload.marchId),
    toX: Math.trunc(payload.toX),
    toY: Math.trunc(payload.toY),
    zoom: payload.zoom,
    panWx: payload.panWx,
    panWy: payload.panWy,
  });
}

export function parseMinimapViewportIntelAnchor(
  raw: string | null | undefined,
): MinimapViewportIntelAnchorPayload | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed = JSON.parse(raw) as {
      marchId?: unknown;
      toX?: unknown;
      toY?: unknown;
      zoom?: unknown;
      panWx?: unknown;
      panWy?: unknown;
    };
    const marchId = Number(parsed.marchId);
    const toX = Number(parsed.toX);
    const toY = Number(parsed.toY);
    const zoom = Number(parsed.zoom);
    const panWx = Number(parsed.panWx);
    const panWy = Number(parsed.panWy);
    if (!Number.isFinite(marchId) || marchId <= 0) return null;
    if (!Number.isFinite(toX) || !Number.isFinite(toY)) return null;
    if (!Number.isFinite(zoom) || zoom < 1) return null;
    if (!Number.isFinite(panWx) || !Number.isFinite(panWy)) return null;
    return {
      marchId: Math.trunc(marchId),
      toX: Math.trunc(toX),
      toY: Math.trunc(toY),
      zoom,
      panWx,
      panWy,
    };
  } catch {
    return null;
  }
}

export function writeMinimapViewportIntelAnchor(
  payload: MinimapViewportIntelAnchorPayload,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  const normalized = parseMinimapViewportIntelAnchor(
    serializeMinimapViewportIntelAnchor(payload),
  );
  if (!normalized) return;
  try {
    storage?.setItem(
      MINIMAP_VIEWPORT_INTEL_ANCHOR_SESSION_KEY,
      serializeMinimapViewportIntelAnchor(normalized),
    );
  } catch {
    /* quota / private mode */
  }
}

export function readMinimapViewportIntelAnchor(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): MinimapViewportIntelAnchorPayload | null {
  try {
    return parseMinimapViewportIntelAnchor(
      storage?.getItem(MINIMAP_VIEWPORT_INTEL_ANCHOR_SESSION_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

function clearMinimapViewportIntelSyncRingClass(
  layoutFrame: HTMLElement | null | undefined,
): void {
  layoutFrame?.classList.remove(MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS);
}

export type BeginMinimapViewportIntelSyncRingOptions = {
  durationMs?: number;
  timers?: MinimapViewportIntelSyncTimers;
};

export function beginMinimapViewportIntelSyncRing(
  layoutFrame: HTMLElement | null | undefined,
  options?: BeginMinimapViewportIntelSyncRingOptions,
): void {
  const duration = options?.durationMs ?? MINIMAP_VIEWPORT_INTEL_SYNC_RING_MS;
  const timers = options?.timers;
  if (timers?.viewportRingClassTimer) {
    clearTimeout(timers.viewportRingClassTimer);
    timers.viewportRingClassTimer = null;
  }
  clearMinimapViewportIntelSyncRingClass(layoutFrame);
  if (!layoutFrame) return;
  layoutFrame.classList.add(MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS);
  void layoutFrame.offsetWidth;
  if (timers && duration > 0) {
    timers.viewportRingClassTimer = setTimeout(() => {
      timers.viewportRingClassTimer = null;
      clearMinimapViewportIntelSyncRingClass(layoutFrame);
    }, duration);
  }
}

export type SyncMinimapViewportToIntelRowInput = {
  march: Pick<MarchSummary, "march_id" | "to_x" | "to_y"> | null | undefined;
  bounds: WorldBounds;
  currentView: MinimapView;
  layoutFrame: HTMLElement | null | undefined;
  minZoom?: number;
};

export type SyncMinimapViewportToIntelRowResult = {
  view: MinimapView;
  applied: boolean;
};

/**
 * 军情列表选中行变更：小地图视口平移至 `to_x`/`to_y` 并触发 viewport sync ring（CLIENT-236）。
 * CLIENT-220 `beginMinimapIntelSyncRingForMarch` 由场景另行调用，本函数不替代。
 */
export function syncMinimapViewportToIntelRow(
  input: SyncMinimapViewportToIntelRowInput,
  options?: BeginMinimapViewportIntelSyncRingOptions & {
    storage?: Pick<Storage, "setItem"> | null;
  },
): SyncMinimapViewportToIntelRowResult {
  const march = input.march;
  if (!march) {
    return { view: input.currentView, applied: false };
  }
  const tx = march.to_x;
  const ty = march.to_y;
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) {
    return { view: input.currentView, applied: false };
  }
  const view = computeMinimapViewFramingPoints(
    input.bounds,
    [{ wx: tx!, wy: ty! }],
    input.minZoom ?? 1,
  );
  beginMinimapViewportIntelSyncRing(input.layoutFrame, options);
  const marchId = march.march_id;
  if (marchId != null && Number.isFinite(marchId) && marchId > 0) {
    writeMinimapViewportIntelAnchor(
      {
        marchId: Math.trunc(marchId),
        toX: Math.trunc(tx!),
        toY: Math.trunc(ty!),
        zoom: view.zoom,
        panWx: view.panWx,
        panWy: view.panWy,
      },
      options?.storage ?? null,
    );
  }
  return { view, applied: true };
}

export function resolveMarchIdAtMinimapViewportCenter(
  marches: MarchSummary[],
  ownCityX: number | undefined,
  ownCityY: number | undefined,
  bounds: WorldBounds,
  rect: MinimapLayoutRect,
  view: MinimapView,
): number | null {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const fromDestHit = findMarchIdForMinimapDestClick(
    cx,
    cy,
    marches,
    ownCityX,
    ownCityY,
    view,
    rect,
  );
  if (fromDestHit != null) return fromDestHit;
  const world = minimapLayoutToWorld(cx, cy, bounds, rect, view);
  if (!world) return null;
  const match = findFirstMarchByDest(marches, world.wx, world.wy);
  const id = match?.march_id;
  if (id == null || !Number.isFinite(id) || id <= 0) return null;
  return Math.trunc(id);
}

function offsetTopWithinScrollBody(row: HTMLElement, scrollBody: HTMLElement): number {
  let top = 0;
  let el: HTMLElement | null = row;
  while (el && el !== scrollBody) {
    top += el.offsetTop;
    el = el.offsetParent as HTMLElement | null;
  }
  return top;
}

export function scrollIntelRowIntoMarchPanelBody(
  intelRoot: ParentNode | null | undefined,
  marchId: number,
): boolean {
  if (!intelRoot || !Number.isFinite(marchId) || marchId <= 0) return false;
  const panel = intelRoot instanceof HTMLElement ? intelRoot : null;
  const scrollBody =
    (panel ? panelScrollBody(panel) : null) ??
    intelRoot.querySelector<HTMLElement>(".panel-scroll-body[data-role='march-scroll']") ??
    intelRoot.querySelector<HTMLElement>(".panel-scroll-body");
  const li = intelRoot.querySelector<HTMLElement>(
    `.march-list li[data-march-id="${Math.trunc(marchId)}"]`,
  );
  if (!li) return false;
  if (scrollBody && typeof scrollBody.scrollTop === "number") {
    const rowTop = offsetTopWithinScrollBody(li, scrollBody);
    const rowBottom = rowTop + li.offsetHeight;
    const viewTop = scrollBody.scrollTop;
    const viewBottom = viewTop + scrollBody.clientHeight;
    if (rowTop < viewTop) {
      scrollBody.scrollTop = rowTop;
    } else if (rowBottom > viewBottom) {
      scrollBody.scrollTop = rowBottom - scrollBody.clientHeight;
    }
    return true;
  }
  li.scrollIntoView?.({ block: "nearest", behavior: "auto" });
  return true;
}

export type ScrollIntelListToVisibleMarchInput = {
  intelRoot: ParentNode | null | undefined;
  marches: MarchSummary[];
  ownCityX?: number;
  ownCityY?: number;
  bounds: WorldBounds;
  rect: MinimapLayoutRect;
  view: MinimapView;
  /** 优先滚动的行军（如 session 焦点）；缺省则取小地图视口中心对应行军。 */
  preferredMarchId?: number | null;
};

/**
 * 小地图拖拽/缩放后：将视口中心对应军情行滚入 `.panel-scroll-body`（CLIENT-236）。
 */
export function scrollIntelListToVisibleMarch(
  input: ScrollIntelListToVisibleMarchInput,
): number | null {
  let marchId = input.preferredMarchId ?? null;
  if (marchId != null && Number.isFinite(marchId)) {
    marchId = Math.trunc(marchId);
  } else {
    marchId = resolveMarchIdAtMinimapViewportCenter(
      input.marches,
      input.ownCityX,
      input.ownCityY,
      input.bounds,
      input.rect,
      input.view,
    );
  }
  if (marchId == null) return null;
  scrollIntelRowIntoMarchPanelBody(input.intelRoot, marchId);
  return marchId;
}

/** @internal vitest */
export function resetMinimapViewportIntelSyncTimersForTests(
  timers: MinimapViewportIntelSyncTimers,
): void {
  if (timers.viewportRingClassTimer) {
    clearTimeout(timers.viewportRingClassTimer);
    timers.viewportRingClassTimer = null;
  }
}
