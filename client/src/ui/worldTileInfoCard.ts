import {
  filterBattleReportsByTimeWindow,
  findMostRecentBattleReportAtGrid,
  type BattleReportSummary,
  type BattleReportTimeWindowFilter,
  type MarchSummary,
} from "@/net/militaryFormat";
import {
  formatCityCoords,
  isCurrentMainCity,
  type PlayerCitySummary,
} from "@/net/worldFormat";
import {
  countMarchesToDestination,
  filterMarchesByDestination,
  findPlayerCityAtGrid,
  formatManhattanFromOwnCity,
} from "@/ui/marchWorldListLink";

export type WorldTileRef = { x: number; y: number };

export type WorldTileInfoCardOptions = {
  ownCityX?: number;
  ownCityY?: number;
  currentCityId?: number;
  /** 战报列表快照（只读，用于格点关联最近战报）。 */
  battleReports?: BattleReportSummary[];
  /** 与战报面板 CLIENT-065 时间窗一致时可传入；默认 all。 */
  battleReportTimeWindow?: BattleReportTimeWindowFilter;
  nowMs?: number;
};

export type WorldTileInfoCardModel = {
  coordsLine: string;
  /** 城池名 + 城墙等级等；无匹配城池时为 null。 */
  cityLine: string | null;
  /** 玩家展示名；无占领数据时为 null。 */
  playerLine: string | null;
  /** 资源格类型；仅当快照带 `tile_resource_type` 或派生规则命中时展示。 */
  terrainLine: string | null;
  /** 无城池且无玩家名时的中性提示。 */
  occupationHintLine: string | null;
  marchCount: number;
  marchCountLine: string;
  manhattanLine: string | null;
  recentBattleReportId: number | null;
  showBattleReportShortcut: boolean;
};

/** @deprecated 使用 `WorldTileInfoCardModel` */
export type WorldTileInfoCardSummary = WorldTileInfoCardModel;

/** @deprecated 使用 `WorldTileInfoCardOptions` */
export type WorldTileInfoCardInput = {
  x: number;
  y: number;
  cities: PlayerCitySummary[];
  marches: MarchSummary[];
  ownCityX?: number;
  ownCityY?: number;
  currentCityId?: number;
};

export const WORLD_TILE_NO_OCCUPATION_HINT =
  "暂无城池或玩家占领信息（只读快照，可刷新城池或查看军情）";

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

/** 从城池或指向此格行军快照解析玩家展示名（不新 world RPC）。 */
export function resolveWorldTilePlayerLine(
  city: PlayerCitySummary | undefined,
  marchesAtGrid: MarchSummary[],
): string | null {
  if (city) {
    const fromCity =
      city.player_name?.trim() ||
      city.owner_name?.trim() ||
      city.display_name?.trim();
    if (fromCity) return fromCity;
  }
  for (const m of marchesAtGrid) {
    const fromMarch =
      m.to_player_name?.trim() ||
      m.destination_player_name?.trim() ||
      m.target_display_name?.trim();
    if (fromMarch) return fromMarch;
  }
  return null;
}

export function formatWorldTileOccupationHint(
  city: PlayerCitySummary | undefined,
  playerLine: string | null,
): string | null {
  if (city != null || playerLine) return null;
  return WORLD_TILE_NO_OCCUPATION_HINT;
}

function resolveRecentBattleReportId(
  reports: BattleReportSummary[],
  x: number,
  y: number,
  timeWindow: BattleReportTimeWindowFilter,
  nowMs: number,
): number | null {
  if (!reports.length) return null;
  const scoped = filterBattleReportsByTimeWindow(reports, timeWindow, nowMs);
  const recent = findMostRecentBattleReportAtGrid(scoped, x, y);
  const id = recent?.report_id;
  return id != null && id > 0 ? id : null;
}

/**
 * 格点 → 只读信息卡模型（纯函数，供 UI 与单测）。
 * 签名：`formatWorldTileInfoCard(tile, cities, marches, options?)`
 */
export function formatWorldTileInfoCard(
  tile: WorldTileRef,
  cities: PlayerCitySummary[],
  marches: MarchSummary[],
  options?: WorldTileInfoCardOptions,
): WorldTileInfoCardModel {
  const { x, y } = tile;
  const {
    ownCityX,
    ownCityY,
    currentCityId,
    battleReports = [],
    battleReportTimeWindow = "all",
    nowMs = Date.now(),
  } = options ?? {};

  const coordsLine = `格点 ${formatCityCoords(x, y)}`;
  const city = findPlayerCityAtGrid(cities, x, y);
  const cityLine = city ? formatCityLevelLine(city, currentCityId) : null;
  const marchesAtGrid = filterMarchesByDestination(marches, x, y);
  const playerLine = resolveWorldTilePlayerLine(city, marchesAtGrid);
  const occupationHintLine = formatWorldTileOccupationHint(city, playerLine);

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
  const recentBattleReportId = resolveRecentBattleReportId(
    battleReports,
    x,
    y,
    battleReportTimeWindow,
    nowMs,
  );

  return {
    coordsLine,
    cityLine,
    playerLine,
    terrainLine,
    occupationHintLine,
    marchCount,
    marchCountLine,
    manhattanLine,
    recentBattleReportId,
    showBattleReportShortcut: recentBattleReportId != null,
  };
}

/** @deprecated 使用 `formatWorldTileInfoCard` */
export function buildWorldTileInfoCardSummary(
  input: WorldTileInfoCardInput,
): WorldTileInfoCardModel {
  return formatWorldTileInfoCard(
    { x: input.x, y: input.y },
    input.cities,
    input.marches,
    {
      ownCityX: input.ownCityX,
      ownCityY: input.ownCityY,
      currentCityId: input.currentCityId,
    },
  );
}
