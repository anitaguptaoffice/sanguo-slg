export type PlayerCitySummary = {
  city_id?: number;
  name?: string;
  x?: number;
  y?: number;
  is_capital?: boolean;
};

/** 世界格点坐标展示，如 (60,60)。 */
export function formatCityCoords(x: number | undefined, y: number | undefined): string {
  const sx = x ?? "?";
  const sy = y ?? "?";
  return `(${sx},${sy})`;
}

export function isCurrentMainCity(city: PlayerCitySummary, currentCityId: number | undefined): boolean {
  if (!currentCityId || !city.city_id) return Boolean(city.is_capital);
  return city.city_id === currentCityId;
}

/** 列表行：城池名 + 坐标；当前所在城附加「主城」。 */
export function formatPlayerCityLine(
  city: PlayerCitySummary,
  currentCityId?: number,
): string {
  const name = city.name?.trim() || `城池#${city.city_id ?? "?"}`;
  const coords = formatCityCoords(city.x, city.y);
  const mainTag = isCurrentMainCity(city, currentCityId) ? " · 主城" : "";
  return `${name} ${coords}${mainTag}`;
}

export function citiesFromListPlayerCitiesResponse(res: {
  cities?: PlayerCitySummary[];
}): PlayerCitySummary[] {
  return [...(res.cities ?? [])];
}

/** 将坐标写入出征表单 to_x/to_y（CLIENT-013 字段）；无表单时返回 false。 */
export function applyMarchTargetToForm(
  formRoot: ParentNode | null | undefined,
  x: number,
  y: number,
): boolean {
  if (!formRoot) return false;
  const xEl = formRoot.querySelector('[data-field="to-x"]') as HTMLInputElement | null;
  const yEl = formRoot.querySelector('[data-field="to-y"]') as HTMLInputElement | null;
  if (!xEl || !yEl) return false;
  xEl.value = String(x);
  yEl.value = String(y);
  return true;
}
