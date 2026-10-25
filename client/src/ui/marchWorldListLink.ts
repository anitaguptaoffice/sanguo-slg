import type { MarchSummary } from "@/net/militaryFormat";
import type { PlayerCitySummary } from "@/net/worldFormat";
import { marchShowsDestOnMinimap } from "@/ui/worldMinimap";

/** 两格点是否为同一世界格（整数格点坐标）。 */
export function gridCellsMatch(
  ax: number | undefined,
  ay: number | undefined,
  bx: number | undefined,
  by: number | undefined,
): boolean {
  if (
    !Number.isFinite(ax) ||
    !Number.isFinite(ay) ||
    !Number.isFinite(bx) ||
    !Number.isFinite(by)
  ) {
    return false;
  }
  return ax === bx && ay === by;
}

/** 曼哈顿格距；任一端坐标无效时返回 null。 */
export function manhattanGridDistance(
  fromX: number | undefined,
  fromY: number | undefined,
  toX: number | undefined,
  toY: number | undefined,
): number | null {
  if (
    typeof fromX !== "number" || typeof fromY !== "number" ||
    typeof toX !== "number" || typeof toY !== "number" ||
    !Number.isFinite(fromX) ||
    !Number.isFinite(fromY) ||
    !Number.isFinite(toX) ||
    !Number.isFinite(toY)
  ) {
    return null;
  }
  return Math.abs(fromX - toX) + Math.abs(fromY - toY);
}

export function findPlayerCityAtGrid(
  cities: PlayerCitySummary[],
  x: number,
  y: number,
): PlayerCitySummary | undefined {
  return cities.find((c) => gridCellsMatch(c.x, c.y, x, y));
}

export function marchDestinationMatchesGrid(
  march: MarchSummary,
  x: number,
  y: number,
): boolean {
  return gridCellsMatch(march.to_x, march.to_y, x, y);
}

/** 客户端过滤 ListMarches 快照：目的格与 (x,y) 一致的行。 */
export function filterMarchesByDestination(
  marches: MarchSummary[],
  x: number,
  y: number,
): MarchSummary[] {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
  return marches.filter((m) => marchDestinationMatchesGrid(m, x, y));
}

/** 指向同一目的格的行军条数（ListMarches 快照，无新 RPC）。 */
export function countMarchesToDestination(
  marches: MarchSummary[],
  x: number,
  y: number,
): number {
  return filterMarchesByDestination(marches, x, y).length;
}

/** 目的格一致且仍为进行中阶段（CLIENT-140 / minimap 目的点口径）。 */
export function filterInProgressMarchesAtCell(
  marches: MarchSummary[],
  x: number,
  y: number,
): MarchSummary[] {
  return filterMarchesByDestination(marches, x, y).filter(marchShowsDestOnMinimap);
}

/** 格点进行中行军条数（ListMarches 客户端过滤，无新 RPC）。 */
export function countMarchesAtCell(marches: MarchSummary[], x: number, y: number): number {
  return filterInProgressMarchesAtCell(marches, x, y).length;
}

/** 世界列表行只读计数文案；0 条时不展示。 */
export function formatWorldCityMarchDestCount(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return `指向此格的行军 ${count} 条`;
}

/** 首条目的格匹配行军（用于世界列表计数点击深链军情）。 */
export function findFirstMarchIdAtDestination(
  marches: MarchSummary[],
  x: number,
  y: number,
): number | null {
  const first = filterMarchesByDestination(marches, x, y)[0];
  const id = first?.march_id;
  return id != null && Number.isFinite(id) ? id : null;
}

/** 距当前主城格点的曼哈顿摘要（复用 session city_x/city_y）。 */
export function formatManhattanFromOwnCity(
  ownCityX: number | undefined,
  ownCityY: number | undefined,
  cellX: number | undefined,
  cellY: number | undefined,
): string | null {
  const d = manhattanGridDistance(ownCityX, ownCityY, cellX, cellY);
  if (d == null) return null;
  return `距主城曼哈顿 ${d} 格`;
}

/** 与 CLIENT-043 状态文案并存：在既有说明后追加距离摘要。 */
export function appendManhattanToStatus(
  baseStatus: string,
  ownCityX: number | undefined,
  ownCityY: number | undefined,
  cellX: number | undefined,
  cellY: number | undefined,
): string {
  const dist = formatManhattanFromOwnCity(ownCityX, ownCityY, cellX, cellY);
  if (!dist) return baseStatus;
  return `${baseStatus} · ${dist}`;
}

export const WORLD_CITY_ROW_MARCH_DEST_CLASS = "world-city-row-march-dest";
export const WORLD_CITY_ROW_SELECTED_CLASS = "world-city-row-selected";
export const WORLD_CITY_COORD_ONLY_CLASS = "world-city-coord-only";
export const WORLD_CITY_ROW_MARCH_COUNT_CLASS = "world-city-row-march-count";
export const MARCH_LIST_ROW_DEST_MATCH_CLASS = "march-list-row-dest-match";

export type MarchDestFilterMode = "all" | "world" | "manual";
