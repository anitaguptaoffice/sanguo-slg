import type { MarchSummary } from "@/net/militaryFormat";
import {
  formatCityCoords,
  isCurrentMainCity,
  type PlayerCitySummary,
} from "@/net/worldFormat";
import {
  countMarchesToDestination,
  findPlayerCityAtGrid,
  formatManhattanFromOwnCity,
} from "@/ui/marchWorldListLink";

export type WorldTileInfoCardInput = {
  x: number;
  y: number;
  cities: PlayerCitySummary[];
  marches: MarchSummary[];
  ownCityX?: number;
  ownCityY?: number;
  currentCityId?: number;
};

export type WorldTileInfoCardSummary = {
  coordsLine: string;
  /** 城池名 + 城墙等级等；无匹配城池时为 null。 */
  cityLine: string | null;
  /** 资源格类型；仅当快照带 `tile_resource_type` 或派生规则命中时展示。 */
  terrainLine: string | null;
  marchCount: number;
  marchCountLine: string;
  manhattanLine: string | null;
};

const RESOURCE_TILE_LABELS: Record<string, string> = {
  food: "粮田",
  wood: "林地",
  stone: "石矿",
  iron: "铁矿",
};

/** ListPlayerCities 或后续 world 快照上的可选资源格类型字段（无则不走本分支）。 */
export function formatResourceTileTypeFromField(
  raw: string | number | undefined | null,
): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const byId: Record<number, string> = { 1: "粮田", 2: "林地", 3: "石矿", 4: "铁矿" };
    return byId[raw] ?? `资源格#${raw}`;
  }
  const key = String(raw).trim().toLowerCase();
  return RESOURCE_TILE_LABELS[key] ?? String(raw).trim();
}

/** 无城池快照时的只读资源格文案（坐标确定性派生，非 world RPC）。 */
export function formatDerivedResourceTileLabel(x: number, y: number): string {
  const kinds = ["粮田", "林地", "石矿", "铁矿"];
  const i = Math.abs((x * 73856093) ^ (y * 19349663)) % kinds.length;
  return kinds[i];
}

export function formatCityLevelLine(city: PlayerCitySummary, currentCityId?: number): string {
  const name = city.name?.trim() || `城池#${city.city_id ?? "?"}`;
  const parts = [name];
  if (city.wall_level != null && Number.isFinite(city.wall_level)) {
    parts.push(`城墙 Lv.${city.wall_level}`);
  }
  if (isCurrentMainCity(city, currentCityId)) {
    parts.push("主城");
  }
  return parts.join(" · ");
}

export function formatMarchCountInfoLine(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "指向此格行军：暂无";
  return `指向此格行军：${count} 条`;
}

/** 格点 → 只读信息卡摘要（纯函数，供 UI 与单测）。 */
export function buildWorldTileInfoCardSummary(
  input: WorldTileInfoCardInput,
): WorldTileInfoCardSummary {
  const { x, y, cities, marches, ownCityX, ownCityY, currentCityId } = input;
  const coordsLine = `格点 ${formatCityCoords(x, y)}`;
  const city = findPlayerCityAtGrid(cities, x, y);
  const cityLine = city ? formatCityLevelLine(city, currentCityId) : null;

  let terrainLine: string | null = null;
  if (city) {
    const fromField = formatResourceTileTypeFromField(city.tile_resource_type);
    if (fromField) terrainLine = `资源格：${fromField}`;
  } else {
    terrainLine = `资源格：${formatDerivedResourceTileLabel(x, y)}（坐标派生）`;
  }

  const marchCount = countMarchesToDestination(marches, x, y);
  const marchCountLine = formatMarchCountInfoLine(marchCount);
  const manhattanLine = formatManhattanFromOwnCity(ownCityX, ownCityY, x, y);

  return {
    coordsLine,
    cityLine,
    terrainLine,
    marchCount,
    marchCountLine,
    manhattanLine,
  };
}
