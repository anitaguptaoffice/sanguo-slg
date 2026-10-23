import type { MarchSummary } from "@/net/militaryFormat";
import { formatMarchPhase } from "@/net/militaryFormat";

/** 世界格点地图边长（与 WORLD-001 一致，用于默认视野）。 */
export const WORLD_MAP_EDGE = 500;

/** 主城舞台上的小地图区域（layout 坐标，位于 STAGE 带内右上角）。 */
export const MINIMAP_LAYOUT_RECT = { x: 1310, y: 72, w: 270, h: 210 };

export type MinimapLayoutRect = typeof MINIMAP_LAYOUT_RECT;

export type MinimapView = {
  /** 相对默认 fit 的缩放倍数，≥ 1。 */
  zoom: number;
  /** 世界坐标平移（格点）。 */
  panWx: number;
  panWy: number;
};

export const DEFAULT_MINIMAP_VIEW: MinimapView = { zoom: 1, panWx: 0, panWy: 0 };

export type WorldBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type MinimapMarkerKind = "own_city" | "march_dest";

export type MinimapMarker = {
  kind: MinimapMarkerKind;
  wx: number;
  wy: number;
  marchId?: number;
};

const DEST_HIT_RADIUS_LAYOUT = 14;

/** 列表中仍应标出目的点的行军（进行中阶段）。 */
export function marchShowsDestOnMinimap(m: MarchSummary): boolean {
  const p = m.phase ?? 0;
  return p === 1 || p === 2 || p === 3 || p === 4;
}

export function collectMinimapDestMarkers(marches: MarchSummary[]): MinimapMarker[] {
  const out: MinimapMarker[] = [];
  for (const m of marches) {
    if (!marchShowsDestOnMinimap(m)) continue;
    const wx = m.to_x;
    const wy = m.to_y;
    if (wx == null || wy == null) continue;
    out.push({ kind: "march_dest", wx, wy, marchId: m.march_id });
  }
  return out;
}

export function computeMinimapWorldBounds(
  ownCityX: number | undefined,
  ownCityY: number | undefined,
  marches: MarchSummary[],
  selected: MarchSummary | null | undefined,
): WorldBounds {
  let minX = 0;
  let minY = 0;
  let maxX = WORLD_MAP_EDGE - 1;
  let maxY = WORLD_MAP_EDGE - 1;
  let hasPoint = false;

  const consider = (wx: number | undefined, wy: number | undefined) => {
    if (wx == null || wy == null) return;
    if (!hasPoint) {
      minX = maxX = wx;
      minY = maxY = wy;
      hasPoint = true;
    } else {
      minX = Math.min(minX, wx);
      minY = Math.min(minY, wy);
      maxX = Math.max(maxX, wx);
      maxY = Math.max(maxY, wy);
    }
  };

  consider(ownCityX, ownCityY);
  for (const m of marches) {
    if (marchShowsDestOnMinimap(m)) {
      consider(m.to_x, m.to_y);
    }
  }
  if (selected) {
    consider(selected.from_x, selected.from_y);
    consider(selected.to_x, selected.to_y);
  }

  if (!hasPoint) {
    return { minX: 0, minY: 0, maxX: WORLD_MAP_EDGE - 1, maxY: WORLD_MAP_EDGE - 1 };
  }

  const pad = Math.max(8, Math.ceil((maxX - minX + maxY - minY) * 0.15) + 4);
  return {
    minX: Math.max(0, minX - pad),
    minY: Math.max(0, minY - pad),
    maxX: Math.min(WORLD_MAP_EDGE - 1, maxX + pad),
    maxY: Math.min(WORLD_MAP_EDGE - 1, maxY + pad),
  };
}

function boundsSpan(b: WorldBounds): { w: number; h: number } {
  return { w: Math.max(1, b.maxX - b.minX + 1), h: Math.max(1, b.maxY - b.minY + 1) };
}

/** 世界格点 → 小地图 layout 坐标（含 zoom/pan）。 */
export function worldToMinimapLayout(
  wx: number,
  wy: number,
  bounds: WorldBounds,
  rect: MinimapLayoutRect,
  view: MinimapView,
): { x: number; y: number } {
  const span = boundsSpan(bounds);
  const cx = (bounds.minX + bounds.maxX) / 2 + view.panWx;
  const cy = (bounds.minY + bounds.maxY) / 2 + view.panWy;
  const halfW = (span.w / view.zoom) / 2;
  const halfH = (span.h / view.zoom) / 2;
  const nx = (wx - (cx - halfW)) / (halfW * 2);
  const ny = (wy - (cy - halfH)) / (halfH * 2);
  return {
    x: rect.x + nx * rect.w,
    y: rect.y + (1 - ny) * rect.h,
  };
}

export function layoutPointInMinimap(
  layoutX: number,
  layoutY: number,
  rect: MinimapLayoutRect = MINIMAP_LAYOUT_RECT,
): boolean {
  return (
    layoutX >= rect.x &&
    layoutX < rect.x + rect.w &&
    layoutY >= rect.y &&
    layoutY < rect.y + rect.h
  );
}

export function findFirstMarchByDest(
  marches: MarchSummary[],
  destX: number,
  destY: number,
): MarchSummary | undefined {
  return marches.find(
    (m) => marchShowsDestOnMinimap(m) && m.to_x === destX && m.to_y === destY,
  );
}

export function findMarchIdForMinimapDestClick(
  layoutX: number,
  layoutY: number,
  marches: MarchSummary[],
  ownCityX: number | undefined,
  ownCityY: number | undefined,
  view: MinimapView,
  rect: MinimapLayoutRect = MINIMAP_LAYOUT_RECT,
): number | undefined {
  if (!layoutPointInMinimap(layoutX, layoutY, rect)) return undefined;
  const bounds = computeMinimapWorldBounds(ownCityX, ownCityY, marches, null);
  const seen = new Set<string>();
  for (const m of marches) {
    if (!marchShowsDestOnMinimap(m)) continue;
    const wx = m.to_x;
    const wy = m.to_y;
    if (wx == null || wy == null) continue;
    const key = `${wx},${wy}`;
    if (seen.has(key)) continue;
    const p = worldToMinimapLayout(wx, wy, bounds, rect, view);
    const dx = layoutX - p.x;
    const dy = layoutY - p.y;
    if (dx * dx + dy * dy <= DEST_HIT_RADIUS_LAYOUT * DEST_HIT_RADIUS_LAYOUT) {
      const first = findFirstMarchByDest(marches, wx, wy);
      return first?.march_id;
    }
    seen.add(key);
  }
  return undefined;
}

export function minimapPhaseCaption(phase: number | undefined): string {
  return formatMarchPhase(phase);
}

export function clampMinimapZoom(zoom: number): number {
  return Math.min(6, Math.max(1, zoom));
}

/** 滚轮缩放：以指针下世界点为锚。 */
export function applyMinimapWheelZoom(
  view: MinimapView,
  bounds: WorldBounds,
  layoutX: number,
  layoutY: number,
  deltaY: number,
  rect: MinimapLayoutRect = MINIMAP_LAYOUT_RECT,
): MinimapView {
  if (!layoutPointInMinimap(layoutX, layoutY, rect)) return view;
  const before = worldToMinimapLayout(
    bounds.minX + boundsSpan(bounds).w / 2,
    bounds.minY + boundsSpan(bounds).h / 2,
    bounds,
    rect,
    view,
  );
  const factor = deltaY < 0 ? 1.12 : 1 / 1.12;
  const nextZoom = clampMinimapZoom(view.zoom * factor);
  if (nextZoom === view.zoom) return view;
  const span = boundsSpan(bounds);
  const anchorWx =
    bounds.minX +
    ((layoutX - rect.x) / rect.w) * span.w / view.zoom +
    view.panWx -
    span.w / (2 * view.zoom);
  const anchorWy =
    bounds.minY +
    (1 - (layoutY - rect.y) / rect.h) * span.h / view.zoom +
    view.panWy -
    span.h / (2 * view.zoom);
  const next: MinimapView = { ...view, zoom: nextZoom };
  const afterCenter = worldToMinimapLayout(
    bounds.minX + span.w / 2,
    bounds.minY + span.h / 2,
    bounds,
    rect,
    next,
  );
  const panAdjustWx = (before.x - afterCenter.x) * (span.w / rect.w) / nextZoom;
  const panAdjustWy = -(before.y - afterCenter.y) * (span.h / rect.h) / nextZoom;
  return {
    zoom: nextZoom,
    panWx: view.panWx + panAdjustWx + (anchorWx - view.panWx) * (1 - view.zoom / nextZoom),
    panWy: view.panWy + panAdjustWy + (anchorWy - view.panWy) * (1 - view.zoom / nextZoom),
  };
}

export function applyMinimapPan(
  view: MinimapView,
  bounds: WorldBounds,
  deltaLayoutX: number,
  deltaLayoutY: number,
  rect: MinimapLayoutRect = MINIMAP_LAYOUT_RECT,
): MinimapView {
  const span = boundsSpan(bounds);
  const wxPerPx = span.w / rect.w / view.zoom;
  const wyPerPx = span.h / rect.h / view.zoom;
  return {
    ...view,
    panWx: view.panWx - deltaLayoutX * wxPerPx,
    panWy: view.panWy + deltaLayoutY * wyPerPx,
  };
}

export function marchSelectionMatchesListRow(
  selectedMarchId: number | null | undefined,
  marchId: number | undefined,
): boolean {
  if (selectedMarchId == null || marchId == null) return false;
  return selectedMarchId === marchId;
}
