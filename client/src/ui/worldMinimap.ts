import type { MarchSummary } from "@/net/militaryFormat";
import {
  formatMarchPhase,
  formatMarchEta,
} from "@/net/militaryFormat";

/** 世界格点地图边长（与 WORLD-001 一致，用于默认视野）。 */
export const WORLD_MAP_EDGE = 500;

/** 主城舞台上的小地图区域（layout 坐标，位于 STAGE 带内右上角）。 */
export const MINIMAP_LAYOUT_RECT = { x: 1310, y: 72, w: 270, h: 210 };

/** CLIENT-145: expanded minimap draw/hit rect at layout-narrow (1600×900 layout space). */
export const MINIMAP_NARROW_EXPANDED_LAYOUT_RECT = { x: 1248, y: 64, w: 340, h: 252 };

/** 折叠后仅保留角标条，不占原 270×210 槽位 hit 区。 */
export const MINIMAP_COLLAPSED_CHROME_RECT = { x: 1310, y: 72, w: 112, h: 28 };

export type MinimapLayoutRect = typeof MINIMAP_LAYOUT_RECT;

export function resolveMinimapExpandedLayoutRect(narrowLayout: boolean): MinimapLayoutRect {
  return narrowLayout ? MINIMAP_NARROW_EXPANDED_LAYOUT_RECT : MINIMAP_LAYOUT_RECT;
}

export const MINIMAP_COLLAPSED_SESSION_KEY = "rxsg.client.worldMinimap.collapsed";

const MARCH_PHASE_MARCHING = 2;
const MARCH_PHASE_RETURNING = 4;

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

export type MinimapWorldPoint = { wx: number; wy: number };

export function computeMinimapWorldBounds(
  ownCityX: number | undefined,
  ownCityY: number | undefined,
  marches: MarchSummary[],
  selected: MarchSummary | null | undefined,
  extraPoints: MinimapWorldPoint[] = [],
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
  for (const p of extraPoints) {
    consider(p.wx, p.wy);
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

/** 将世界格点坐标限制在 0..WORLD_MAP_EDGE-1。 */
export function clampWorldMapCoord(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(WORLD_MAP_EDGE - 1, Math.max(0, Math.round(value)));
}

/** 小地图 layout → 世界格点（含 zoom/pan）；点在 rect 外返回 null。 */
export function minimapLayoutToWorld(
  layoutX: number,
  layoutY: number,
  bounds: WorldBounds,
  rect: MinimapLayoutRect,
  view: MinimapView,
): { wx: number; wy: number } | null {
  if (!layoutPointInMinimap(layoutX, layoutY, rect)) return null;
  const span = boundsSpan(bounds);
  const cx = (bounds.minX + bounds.maxX) / 2 + view.panWx;
  const cy = (bounds.minY + bounds.maxY) / 2 + view.panWy;
  const halfW = span.w / view.zoom / 2;
  const halfH = span.h / view.zoom / 2;
  const nx = (layoutX - rect.x) / rect.w;
  const ny = 1 - (layoutY - rect.y) / rect.h;
  const wx = nx * halfW * 2 + (cx - halfW);
  const wy = ny * halfH * 2 + (cy - halfH);
  return { wx: clampWorldMapCoord(wx), wy: clampWorldMapCoord(wy) };
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

/** 展开时完整小地图交互区；折叠时无地图区（不挡建筑槽位）。 */
export function minimapMapInteractionRect(
  collapsed: boolean,
  narrowLayout = false,
): MinimapLayoutRect | null {
  return collapsed ? null : resolveMinimapExpandedLayoutRect(narrowLayout);
}

export function layoutPointInMinimapMap(
  layoutX: number,
  layoutY: number,
  collapsed: boolean,
  narrowLayout = false,
): boolean {
  const rect = minimapMapInteractionRect(collapsed, narrowLayout);
  return rect != null && layoutPointInMinimap(layoutX, layoutY, rect);
}

export function minimapCollapseToggleRect(
  collapsed: boolean,
  narrowLayout = false,
): MinimapLayoutRect {
  if (collapsed) return MINIMAP_COLLAPSED_CHROME_RECT;
  const mapRect = resolveMinimapExpandedLayoutRect(narrowLayout);
  return {
    x: mapRect.x + mapRect.w - 28,
    y: mapRect.y + 2,
    w: 26,
    h: 22,
  };
}

export function layoutPointInMinimapToggle(
  layoutX: number,
  layoutY: number,
  collapsed: boolean,
  narrowLayout = false,
): boolean {
  return layoutPointInMinimap(
    layoutX,
    layoutY,
    minimapCollapseToggleRect(collapsed, narrowLayout),
  );
}

export function readMinimapCollapsedFromSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): boolean {
  try {
    return storage?.getItem(MINIMAP_COLLAPSED_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeMinimapCollapsedToSession(
  collapsed: boolean,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.setItem(MINIMAP_COLLAPSED_SESSION_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}

/** 战报坐标复盘等入口：强制展开小地图并写入会话（CLIENT-142）。 */
export function openWorldMinimapExpanded(
  collapsed: boolean,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): { collapsed: false; didExpand: boolean } {
  const didExpand = collapsed;
  if (collapsed) {
    writeMinimapCollapsedToSession(false, storage);
  }
  return { collapsed: false, didExpand };
}

export function marchHasRouteOnMinimap(m: MarchSummary): boolean {
  if (!marchShowsDestOnMinimap(m)) return false;
  return m.from_x != null && m.from_y != null && m.to_x != null && m.to_y != null;
}

export type MinimapMarchRouteStroke = {
  color: string;
  lineWidth: number;
  dash: number[];
};

/** 选中行样式优先；否则按 marching / returning 区分实线/虚线。 */
export function minimapMarchRouteStroke(
  phase: number | undefined,
  isSelected: boolean,
): MinimapMarchRouteStroke {
  if (isSelected) {
    return { color: "#f0c674", lineWidth: 3, dash: [] };
  }
  const p = phase ?? 0;
  if (p === MARCH_PHASE_RETURNING) {
    return { color: "#8ab4f8", lineWidth: 2, dash: [8, 5] };
  }
  if (p === MARCH_PHASE_MARCHING) {
    return { color: "#c97b63", lineWidth: 2, dash: [] };
  }
  return { color: "rgba(201, 123, 99, 0.55)", lineWidth: 1.5, dash: [4, 4] };
}

function pickNiceScaleWorldUnits(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const exp = Math.floor(Math.log10(raw));
  const pow = Math.pow(10, exp);
  const norm = raw / pow;
  let nice = 10;
  if (norm <= 1) nice = 1;
  else if (norm <= 2) nice = 2;
  else if (norm <= 5) nice = 5;
  return nice * pow;
}

export type MinimapScaleBarSpec = {
  /** 角标文案，如「≈25格」。 */
  label: string;
  /** 比例尺条在 layout 上的长度（px）。 */
  barLayoutPx: number;
  worldUnits: number;
};

/** 由小地图舞台尺寸与当前视野推导近似比例尺（纯函数）。 */
export function computeMinimapScaleBar(
  bounds: WorldBounds,
  rect: MinimapLayoutRect,
  view: MinimapView,
  targetBarLayoutPx = 64,
): MinimapScaleBarSpec {
  const span = boundsSpan(bounds);
  const visibleWorldW = span.w / view.zoom;
  const worldPerLayoutPx = visibleWorldW / Math.max(1, rect.w);
  const rawUnits = worldPerLayoutPx * targetBarLayoutPx;
  const worldUnits = pickNiceScaleWorldUnits(rawUnits);
  const barLayoutPx = worldUnits / worldPerLayoutPx;
  const label = `≈${worldUnits}格`;
  return { label, barLayoutPx, worldUnits };
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

export const MINIMAP_DEST_ETA_LEGEND = "点=目的格 · 数字=剩余时间";

const MINIMAP_PHASE_SHORT_LABEL: Record<number, string> = {
  1: "待",
  3: "达",
};

/** 待发/已到达等小地图角标阶段简写（行军中/返程中用剩余分钟数字）。 */
export function minimapMarchPhaseShortLabel(phase: number | undefined): string {
  const p = phase ?? 0;
  return MINIMAP_PHASE_SHORT_LABEL[p] ?? formatMarchPhase(phase);
}

/** 目的点旁是否绘制 ETA/阶段角标（与目的点可见性一致）。 */
export function minimapDestShowsEtaBadge(m: MarchSummary): boolean {
  return marchShowsDestOnMinimap(m);
}

/** 小地图目的点角标文案；行军中/返程中与军情列表共用 nowMs 与 {@link formatMarchRemainingMs} 口径。 */
export function formatMinimapDestEtaLabel(m: MarchSummary, nowMs: number): string {
  const phase = m.phase ?? 0;
  if (phase === MARCH_PHASE_MARCHING || phase === MARCH_PHASE_RETURNING) {
    return formatMarchEta(m, nowMs, true);
  }
  return minimapMarchPhaseShortLabel(phase);
}

/** @deprecated 使用 {@link formatMinimapDestEtaLabel} */
export const minimapDestEtaBadgeLabel = formatMinimapDestEtaLabel;

/** 折叠小地图时状态栏复述选中行军 ETA/阶段。 */
export function formatMinimapCollapsedSelectedMarchStatus(m: MarchSummary, nowMs: number): string {
  const id = m.march_id ?? "?";
  const dest = `(${m.to_x ?? "?"},${m.to_y ?? "?"})`;
  const phase = m.phase ?? 0;
  if (phase === MARCH_PHASE_MARCHING || phase === MARCH_PHASE_RETURNING) {
    return `行军 #${id} → ${dest} · ${formatMarchEta(m, nowMs)}`;
  }
  return `行军 #${id} → ${dest} · ${minimapMarchPhaseShortLabel(phase)}`;
}

/** 将角标文本锚点限制在小地图 rect 内，避免贴边裁切。 */
export function clampMinimapEtaLabelLayout(
  anchorX: number,
  anchorY: number,
  textWidth: number,
  textHeight: number,
  rect: MinimapLayoutRect = MINIMAP_LAYOUT_RECT,
  pad = 2,
): { x: number; y: number } {
  let x = anchorX + 8;
  let y = anchorY - textHeight * 0.5;
  if (x + textWidth > rect.x + rect.w - pad) {
    x = anchorX - textWidth - 8;
  }
  x = Math.max(rect.x + pad, Math.min(x, rect.x + rect.w - textWidth - pad));
  y = Math.max(rect.y + pad, Math.min(y, rect.y + rect.h - textHeight - pad));
  return { x, y };
}

export function minimapPhaseCaption(m: MarchSummary, nowMs: number): string {
  const phase = m.phase ?? 0;
  if (phase === MARCH_PHASE_MARCHING || phase === MARCH_PHASE_RETURNING) {
    return `${formatMarchPhase(phase)} · ${formatMarchEta(m, nowMs)}`;
  }
  return formatMarchPhase(phase);
}

export function clampMinimapZoom(zoom: number): number {
  return Math.min(6, Math.max(1, zoom));
}

const REPLAY_FOCUS_PAD_WORLD = 14;

/** 将视野 pan/zoom 到纳入指定世界点（战报复盘等小地图导航）。 */
export function computeMinimapViewFramingPoints(
  bounds: WorldBounds,
  points: MinimapWorldPoint[],
  minZoom = 1.5,
): MinimapView {
  if (!points.length) return { ...DEFAULT_MINIMAP_VIEW };
  let minX = points[0].wx;
  let maxX = points[0].wx;
  let minY = points[0].wy;
  let maxY = points[0].wy;
  for (const p of points) {
    minX = Math.min(minX, p.wx);
    maxX = Math.max(maxX, p.wx);
    minY = Math.min(minY, p.wy);
    maxY = Math.max(maxY, p.wy);
  }
  minX -= REPLAY_FOCUS_PAD_WORLD;
  maxX += REPLAY_FOCUS_PAD_WORLD;
  minY -= REPLAY_FOCUS_PAD_WORLD;
  maxY += REPLAY_FOCUS_PAD_WORLD;
  const focusSpan = boundsSpan({ minX, minY, maxX, maxY });
  const baseSpan = boundsSpan(bounds);
  const zoomW = baseSpan.w / Math.max(1, focusSpan.w);
  const zoomH = baseSpan.h / Math.max(1, focusSpan.h);
  const zoom = clampMinimapZoom(Math.max(minZoom, zoomW, zoomH));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const baseCx = (bounds.minX + bounds.maxX) / 2;
  const baseCy = (bounds.minY + bounds.maxY) / 2;
  return {
    zoom,
    panWx: cx - baseCx,
    panWy: cy - baseCy,
  };
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
