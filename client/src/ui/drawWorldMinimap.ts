import type { AssetLoader } from "@/engine/AssetLoader";
import {
  MINIMAP_DEST_MARKER_ASSET_ID,
  resolveMinimapDestMarkerDrawMode,
} from "@/engine/artMinimapDestSkin";
import type { MarchSummary } from "@/net/militaryFormat";
import { layoutMinimapMarchStackBadges } from "@/ui/minimapMarchStack";
import {
  isMinimapIntelSyncRingActive,
  MINIMAP_INTEL_SYNC_RING_COLOR,
  type MinimapIntelSyncRingState,
} from "@/ui/minimapIntelSyncHighlight";
import {
  MINIMAP_MARCH_END_RING_COLOR,
  isMinimapFocusPulseActive,
  type MinimapMarchEndHighlight,
} from "@/ui/minimapTileFocusLink";
import {
  MINIMAP_COLLAPSED_CHROME_RECT,
  MINIMAP_DEST_ETA_LEGEND,
  MINIMAP_LAYOUT_RECT,
  type MinimapLayoutRect,
  type MinimapView,
  clampMinimapEtaLabelLayout,
  computeMinimapScaleBar,
  computeMinimapWorldBounds,
  findFirstMarchByDest,
  formatMinimapDestEtaLabel,
  marchHasRouteOnMinimap,
  minimapDestShowsEtaBadge,
  minimapMarchRouteStroke,
  minimapPhaseCaption,
  worldToMinimapLayout,
} from "@/ui/worldMinimap";

export function drawWorldMinimap(
  c2d: CanvasRenderingContext2D,
  opts: {
    ownCityX?: number;
    ownCityY?: number;
    marches: MarchSummary[];
    selectedMarchId?: number | null;
    view: MinimapView;
    rect?: MinimapLayoutRect;
    collapsed?: boolean;
    battleReportReplay?: { wx: number; wy: number } | null;
    /** 世界信息卡选中格（与军情选中目的格区分，CLIENT-073）。 */
    focusGrid?: { wx: number; wy: number } | null;
    /** CLIENT-188：信息卡反向定位 2s 脉冲窗口（毫秒时间戳）。 */
    focusPulseUntilMs?: number;
    /** CLIENT-188：军情选中行军终点叠加环（与信息卡可叠加）。 */
    marchEndHighlight?: MinimapMarchEndHighlight | null;
    /** CLIENT-220：军情列表选中后 1.5s 目的格 sync 焦点环。 */
    intelSyncRing?: MinimapIntelSyncRingState | null;
    nowMs?: number;
    assets?: AssetLoader;
    /** 用于检测 `data-art-skin=off`（如 `#layout-frame`）。 */
    artSkinAnchor?: HTMLElement | null;
  },
): void {
  const collapsed = opts.collapsed ?? false;
  if (collapsed) {
    drawMinimapCollapsedChrome(c2d);
    return;
  }

  const rect = opts.rect ?? MINIMAP_LAYOUT_RECT;
  const nowMs = opts.nowMs ?? Date.now();
  const selected =
    opts.selectedMarchId != null
      ? opts.marches.find((m) => m.march_id === opts.selectedMarchId)
      : null;
  const replayExtra = opts.battleReportReplay ? [opts.battleReportReplay] : [];
  const focusExtra = opts.focusGrid ? [opts.focusGrid] : [];
  const bounds = computeMinimapWorldBounds(
    opts.ownCityX,
    opts.ownCityY,
    opts.marches,
    selected,
    [...replayExtra, ...focusExtra],
  );
  const focus = opts.focusGrid;

  c2d.save();
  c2d.fillStyle = "rgba(12, 10, 8, 0.72)";
  c2d.strokeStyle = "rgba(245, 230, 200, 0.55)";
  c2d.lineWidth = 2;
  c2d.fillRect(rect.x, rect.y, rect.w, rect.h);
  c2d.strokeRect(rect.x, rect.y, rect.w, rect.h);

  c2d.fillStyle = "rgba(245, 230, 200, 0.85)";
  c2d.font = "11px system-ui";
  c2d.fillText("世界（只读）", rect.x + 8, rect.y + 16);
  c2d.fillStyle = "rgba(245, 230, 200, 0.55)";
  c2d.font = "9px system-ui";
  c2d.fillText(MINIMAP_DEST_ETA_LEGEND, rect.x + 8, rect.y + 30);
  drawMinimapCollapseGlyph(c2d, rect.x + rect.w - 22, rect.y + 6);

  const scale = computeMinimapScaleBar(bounds, rect, opts.view);
  const scaleY = rect.y + rect.h - 12;
  const scaleX = rect.x + rect.w - scale.barLayoutPx - 10;
  c2d.strokeStyle = "rgba(245, 230, 200, 0.75)";
  c2d.lineWidth = 2;
  c2d.beginPath();
  c2d.moveTo(scaleX, scaleY);
  c2d.lineTo(scaleX + scale.barLayoutPx, scaleY);
  c2d.stroke();
  c2d.fillStyle = "rgba(245, 230, 200, 0.7)";
  c2d.font = "10px system-ui";
  c2d.fillText(scale.label, scaleX, scaleY - 4);

  const destMarkerMode = resolveMinimapDestMarkerDrawMode(opts.artSkinAnchor, opts.assets ?? null);
  const destSpritePack =
    destMarkerMode === "sprite" ? opts.assets?.getImageForAsset(MINIMAP_DEST_MARKER_ASSET_ID) : null;

  const drawDot = (
    wx: number,
    wy: number,
    color: string,
    radius = 5,
    style: "city" | "march_dest" = "city",
  ) => {
    const p = worldToMinimapLayout(wx, wy, bounds, rect, opts.view);
    if (style === "march_dest" && destSpritePack) {
      const size = radius * 2.4;
      c2d.drawImage(destSpritePack.img, p.x - size / 2, p.y - size / 2, size, size);
      return;
    }
    c2d.beginPath();
    c2d.fillStyle = color;
    c2d.arc(p.x, p.y, radius, 0, Math.PI * 2);
    c2d.fill();
    if (style === "march_dest") {
      c2d.strokeStyle = isSelStrokeColor(color) ? "#f0c674" : "rgba(245, 230, 200, 0.9)";
      c2d.lineWidth = isSelStrokeColor(color) ? 2.5 : 1.5;
      c2d.stroke();
    }
  };

  function isSelStrokeColor(color: string): boolean {
    return color === "#f0c674";
  }

  const drawRoute = (m: MarchSummary, isSel: boolean) => {
    const fx = m.from_x!;
    const fy = m.from_y!;
    const tx = m.to_x!;
    const ty = m.to_y!;
    const from = worldToMinimapLayout(fx, fy, bounds, rect, opts.view);
    const to = worldToMinimapLayout(tx, ty, bounds, rect, opts.view);
    const stroke = minimapMarchRouteStroke(m.phase, isSel);
    c2d.beginPath();
    c2d.strokeStyle = stroke.color;
    c2d.lineWidth = stroke.lineWidth;
    c2d.setLineDash(stroke.dash);
    c2d.moveTo(from.x, from.y);
    c2d.lineTo(to.x, to.y);
    c2d.stroke();
    c2d.setLineDash([]);
  };

  for (const m of opts.marches) {
    if (!marchHasRouteOnMinimap(m)) continue;
    const isSel = selected?.march_id != null && m.march_id === selected.march_id;
    drawRoute(m, isSel);
  }

  if (opts.ownCityX != null && opts.ownCityY != null) {
    drawDot(opts.ownCityX, opts.ownCityY, "#7ec8e3", 6);
  }

  const destSeen = new Set<string>();
  const stackDestKeys: { wx: number; wy: number }[] = [];
  c2d.font = "10px system-ui";
  for (const m of opts.marches) {
    const wx = m.to_x;
    const wy = m.to_y;
    if (wx == null || wy == null) continue;
    const key = `${wx},${wy}`;
    if (destSeen.has(key)) continue;
    destSeen.add(key);
    stackDestKeys.push({ wx, wy });
    const matchesFocus =
      focus != null && focus.wx === wx && focus.wy === wy;
    const isSel =
      (selected && selected.to_x === wx && selected.to_y === wy) || matchesFocus;
    drawDot(wx, wy, isSel ? "#f0c674" : "#c97b63", isSel ? 7 : 5, "march_dest");
    const marchForBadge = findFirstMarchByDest(opts.marches, wx, wy);
    if (marchForBadge && minimapDestShowsEtaBadge(marchForBadge)) {
      const label = formatMinimapDestEtaLabel(marchForBadge, nowMs);
      const p = worldToMinimapLayout(wx, wy, bounds, rect, opts.view);
      const metrics = c2d.measureText(label);
      const textH = 10;
      const pos = clampMinimapEtaLabelLayout(p.x, p.y, metrics.width, textH, rect);
      c2d.fillStyle = isSel ? "#f0c674" : "rgba(245, 230, 200, 0.88)";
      c2d.fillText(label, pos.x, pos.y + textH - 2);
    }
  }

  const stackBadges = layoutMinimapMarchStackBadges(
    opts.marches,
    stackDestKeys,
    (wx, wy) => worldToMinimapLayout(wx, wy, bounds, rect, opts.view),
  );
  if (stackBadges.length > 0) {
    c2d.font = "bold 10px system-ui";
    for (const badge of stackBadges) {
      const metrics = c2d.measureText(badge.label);
      const padX = 3;
      const padY = 2;
      const w = metrics.width + padX * 2;
      const h = 12;
      c2d.fillStyle = "rgba(18, 14, 10, 0.82)";
      c2d.fillRect(badge.x - padX, badge.y - h + padY, w, h);
      c2d.strokeStyle = "rgba(245, 230, 200, 0.75)";
      c2d.lineWidth = 1;
      c2d.strokeRect(badge.x - padX, badge.y - h + padY, w, h);
      c2d.fillStyle = "#f0c674";
      c2d.fillText(badge.label, badge.x, badge.y);
    }
  }

  if (selected) {
    if (selected.from_x != null && selected.from_y != null) {
      drawDot(selected.from_x, selected.from_y, "#9cdcfe", 6);
    }
    if (selected.to_x != null && selected.to_y != null) {
      drawDot(selected.to_x, selected.to_y, "#f0c674", 7);
    }
    const caption = minimapPhaseCaption(selected, nowMs);
    c2d.fillStyle = "#f0c674";
    c2d.font = "12px system-ui";
    c2d.fillText(caption, rect.x + 8, rect.y + rect.h - 28);
  }

  const focusPulseActive = isMinimapFocusPulseActive(
    opts.focusPulseUntilMs ?? 0,
    nowMs,
  );
  if (focus && (focus.wx != null || focus.wy != null)) {
    const p = worldToMinimapLayout(focus.wx, focus.wy, bounds, rect, opts.view);
    const selectedAtFocus =
      selected?.to_x === focus.wx && selected?.to_y === focus.wy;
    if (!selectedAtFocus) {
      c2d.beginPath();
      c2d.strokeStyle = focusPulseActive ? "#f0c674" : "#c9a227";
      c2d.lineWidth = focusPulseActive ? 3 : 2;
      c2d.arc(p.x, p.y, focusPulseActive ? 12 : 10, 0, Math.PI * 2);
      c2d.stroke();
    }
  }

  const marchEnd = opts.marchEndHighlight;
  if (marchEnd) {
    const p = worldToMinimapLayout(marchEnd.wx, marchEnd.wy, bounds, rect, opts.view);
    c2d.beginPath();
    c2d.strokeStyle = MINIMAP_MARCH_END_RING_COLOR;
    c2d.lineWidth = 2.5;
    c2d.setLineDash([5, 4]);
    c2d.arc(p.x, p.y, 13, 0, Math.PI * 2);
    c2d.stroke();
    c2d.setLineDash([]);
  }

  const intelRing = opts.intelSyncRing;
  if (
    intelRing &&
    isMinimapIntelSyncRingActive(intelRing.untilMs, nowMs)
  ) {
    const p = worldToMinimapLayout(intelRing.wx, intelRing.wy, bounds, rect, opts.view);
    c2d.beginPath();
    c2d.strokeStyle = MINIMAP_INTEL_SYNC_RING_COLOR;
    c2d.lineWidth = 3;
    c2d.arc(p.x, p.y, 15, 0, Math.PI * 2);
    c2d.stroke();
  }

  const replay = opts.battleReportReplay;
  if (replay) {
    const p = worldToMinimapLayout(replay.wx, replay.wy, bounds, rect, opts.view);
    c2d.beginPath();
    c2d.strokeStyle = "#ff8a65";
    c2d.lineWidth = 3;
    c2d.arc(p.x, p.y, 11, 0, Math.PI * 2);
    c2d.stroke();
    c2d.beginPath();
    c2d.fillStyle = "#ff6b6b";
    c2d.arc(p.x, p.y, 6, 0, Math.PI * 2);
    c2d.fill();
    c2d.fillStyle = "#ffe0d6";
    c2d.font = "11px system-ui";
    c2d.fillText("战报", rect.x + 8, rect.y + rect.h - 12);
  }

  c2d.restore();
}

function drawMinimapCollapsedChrome(c2d: CanvasRenderingContext2D): void {
  const rect = MINIMAP_COLLAPSED_CHROME_RECT;
  c2d.save();
  c2d.fillStyle = "rgba(12, 10, 8, 0.78)";
  c2d.strokeStyle = "rgba(245, 230, 200, 0.55)";
  c2d.lineWidth = 2;
  c2d.fillRect(rect.x, rect.y, rect.w, rect.h);
  c2d.strokeRect(rect.x, rect.y, rect.w, rect.h);
  c2d.fillStyle = "rgba(245, 230, 200, 0.9)";
  c2d.font = "11px system-ui";
  c2d.fillText("世界 ▶", rect.x + 8, rect.y + 18);
  c2d.restore();
}

function drawMinimapCollapseGlyph(c2d: CanvasRenderingContext2D, x: number, y: number): void {
  c2d.fillStyle = "rgba(245, 230, 200, 0.65)";
  c2d.font = "12px system-ui";
  c2d.fillText("▼", x, y + 12);
}
