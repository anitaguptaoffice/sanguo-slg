import type { MarchSummary } from "@/net/militaryFormat";
import {
  MINIMAP_LAYOUT_RECT,
  type MinimapLayoutRect,
  type MinimapView,
  computeMinimapWorldBounds,
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
  },
): void {
  const rect = opts.rect ?? MINIMAP_LAYOUT_RECT;
  const selected =
    opts.selectedMarchId != null
      ? opts.marches.find((m) => m.march_id === opts.selectedMarchId)
      : null;
  const bounds = computeMinimapWorldBounds(
    opts.ownCityX,
    opts.ownCityY,
    opts.marches,
    selected,
  );

  c2d.save();
  c2d.fillStyle = "rgba(12, 10, 8, 0.72)";
  c2d.strokeStyle = "rgba(245, 230, 200, 0.55)";
  c2d.lineWidth = 2;
  c2d.fillRect(rect.x, rect.y, rect.w, rect.h);
  c2d.strokeRect(rect.x, rect.y, rect.w, rect.h);

  c2d.fillStyle = "rgba(245, 230, 200, 0.85)";
  c2d.font = "11px system-ui";
  c2d.fillText("世界（只读）", rect.x + 8, rect.y + 16);

  const drawDot = (wx: number, wy: number, color: string, radius = 5) => {
    const p = worldToMinimapLayout(wx, wy, bounds, rect, opts.view);
    c2d.beginPath();
    c2d.fillStyle = color;
    c2d.arc(p.x, p.y, radius, 0, Math.PI * 2);
    c2d.fill();
  };

  if (opts.ownCityX != null && opts.ownCityY != null) {
    drawDot(opts.ownCityX, opts.ownCityY, "#7ec8e3", 6);
  }

  const destSeen = new Set<string>();
  for (const m of opts.marches) {
    const wx = m.to_x;
    const wy = m.to_y;
    if (wx == null || wy == null) continue;
    const key = `${wx},${wy}`;
    if (destSeen.has(key)) continue;
    destSeen.add(key);
    const isSel = selected && selected.to_x === wx && selected.to_y === wy;
    drawDot(wx, wy, isSel ? "#f0c674" : "#c97b63", isSel ? 7 : 5);
  }

  if (selected) {
    if (selected.from_x != null && selected.from_y != null) {
      drawDot(selected.from_x, selected.from_y, "#9cdcfe", 6);
    }
    if (selected.to_x != null && selected.to_y != null) {
      drawDot(selected.to_x, selected.to_y, "#f0c674", 7);
    }
    const caption = minimapPhaseCaption(selected.phase);
    c2d.fillStyle = "#f0c674";
    c2d.font = "12px system-ui";
    c2d.fillText(caption, rect.x + 8, rect.y + rect.h - 10);
  }

  c2d.restore();
}
