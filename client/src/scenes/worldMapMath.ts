/** Isometric projection and hit-testing for the full-screen world map. */

export const TILE_W = 64;
export const TILE_H = 32;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 2;

export type Camera = { centerX: number; centerY: number; zoom: number };
export type ViewportSize = { width: number; height: number };
export type ScreenPoint = { x: number; y: number };
export type TilePoint = { x: number; y: number };

/** Screen point of the top face centre of one world tile. */
export function projectTile(tileX: number, tileY: number, camera: Camera, size: ViewportSize): ScreenPoint {
  const halfW = (TILE_W / 2) * camera.zoom;
  const halfH = (TILE_H / 2) * camera.zoom;
  const dx = tileX - camera.centerX;
  const dy = tileY - camera.centerY;
  return {
    x: size.width / 2 + (dx - dy) * halfW,
    y: size.height / 2 + (dx + dy) * halfH,
  };
}

/** Nearest tile centre for a screen point; the diamond lattice inverts exactly. */
export function tileAtScreen(point: ScreenPoint, camera: Camera, size: ViewportSize): TilePoint {
  const halfW = (TILE_W / 2) * camera.zoom;
  const halfH = (TILE_H / 2) * camera.zoom;
  const dx = (point.x - size.width / 2) / halfW;
  const dy = (point.y - size.height / 2) / halfH;
  return {
    x: Math.round(camera.centerX + (dx + dy) / 2),
    y: Math.round(camera.centerY + (dy - dx) / 2),
  };
}

/** Inclusive tile rectangle covering the screen plus a margin of tiles. */
export function visibleTileBounds(camera: Camera, size: ViewportSize, margin = 2): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const halfW = (TILE_W / 2) * camera.zoom;
  const halfH = (TILE_H / 2) * camera.zoom;
  const spanX = size.width / halfW / 2 + margin;
  const spanY = size.height / halfH / 2 + margin;
  return {
    minX: Math.floor(camera.centerX - spanX),
    minY: Math.floor(camera.centerY - spanY),
    maxX: Math.ceil(camera.centerX + spanX),
    maxY: Math.ceil(camera.centerY + spanY),
  };
}

/** Radius sent to GetWorldViewport so panned views are already covered. */
export function fetchRadius(camera: Camera, size: ViewportSize): { x: number; y: number } {
  const bounds = visibleTileBounds(camera, size, 6);
  return {
    x: Math.max(Math.abs(bounds.maxX - camera.centerX), Math.abs(camera.centerX - bounds.minX)),
    y: Math.max(Math.abs(bounds.maxY - camera.centerY), Math.abs(camera.centerY - bounds.minY)),
  };
}

export function clampCamera(camera: Camera, mapSize: number): Camera {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, camera.zoom));
  return {
    zoom,
    centerX: Math.min(mapSize - 1, Math.max(0, camera.centerX)),
    centerY: Math.min(mapSize - 1, Math.max(0, camera.centerY)),
  };
}

/** Full-screen switch keeps the tile under the cursor while zooming. */
export function zoomAround(camera: Camera, point: ScreenPoint, size: ViewportSize, nextZoom: number): Camera {
  const before = tileAtScreen(point, camera, size);
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
  // Solve the new centre so `before` still projects to the same screen point.
  const halfW = (TILE_W / 2) * zoom;
  const halfH = (TILE_H / 2) * zoom;
  const dx = (point.x - size.width / 2) / halfW;
  const dy = (point.y - size.height / 2) / halfH;
  return {
    zoom,
    centerX: before.x - (dx + dy) / 2,
    centerY: before.y - (dy - dx) / 2,
  };
}

const TERRAIN_FILL: Record<number, string> = {
  0: "#c8a24a",
  1: "#8fbf5f",
  2: "#d8c07a",
  3: "#3f7a45",
  4: "#a7c96a",
  5: "#8a8070",
  6: "#4f8fbf",
  7: "#5f6f4f",
};

/** Fill colour for one terrain id (0..7). */
export function terrainFill(terrain: number): string {
  return TERRAIN_FILL[terrain] ?? "#7a7a7a";
}

/** Short player-facing name for one terrain id. */
export function terrainLabel(terrain: number): string {
  return (
    ["城池", "平地", "荒漠", "森林", "草原", "山地", "湖泊", "沼泽"][terrain] ?? "未知"
  );
}
