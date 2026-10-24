import {
  MARCH_FORM_INFANTRY_UNIT_CFG_ID,
  type MarchFormValidationInput,
  validateMarchForm,
  WORLD_MAP_COORD_MAX,
} from "@/net/marchFormValidation";
import type { CityTroopStack, MarchSummary } from "@/net/militaryFormat";
import { unitLabel } from "@/net/militaryFormat";
import {
  scrollIntelRowForCoords,
  type ScrollIntelRowForCoordsOptions,
} from "@/net/marchFormCoordSync";
import {
  filterMarchesByDestination,
  manhattanGridDistance,
} from "@/ui/marchWorldListLink";

/** 出征表单顶栏：已选兵力 vs 城内余量只读对比（CLIENT-206）。 */
export const MARCH_FORM_TROOP_RESERVE_LINE_ROLE = "march-form-troop-reserve-line";
export const MARCH_FORM_RESERVE_WARN_CLASS = "march-form-reserve-warn";
export const MARCH_FORM_RESERVE_JUMP_INTEL_ACTION = "march-form-reserve-jump-intel";

export type MarchFormTroopReserveLineResult = {
  line: string | null;
  insufficient: boolean;
  selected: number | null;
  available: number;
};

export type ScrollIntelRowForMarchFormContext = {
  preferredMarchId: number | null;
  toX: number | null;
  toY: number | null;
};

function parsePositiveIntMarchCount(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return null;
  return n;
}

export function availableInfantryInCity(cityTroops: CityTroopStack[]): number {
  const stack = cityTroops.find((t) => t.unit_cfg_id === MARCH_FORM_INFANTRY_UNIT_CFG_ID);
  return stack?.count ?? 0;
}

/**
 * 出征步兵已选 vs 城内可用余量只读文案；无法解析已选数量时返回 `line: null`（隐藏顶栏）。
 */
export function formatMarchFormTroopReserveLine(
  selected: number,
  available: number,
  unitCfgId = MARCH_FORM_INFANTRY_UNIT_CFG_ID,
): MarchFormTroopReserveLineResult {
  const label = unitLabel(unitCfgId);
  const insufficient = selected > available;
  const line = insufficient
    ? `${label} 已选 ${selected} / 城内可用 ${available}（超出 ${selected - available}）`
    : `${label} 已选 ${selected} / 城内可用 ${available}`;
  return { line, insufficient, selected, available };
}

export function buildMarchFormTroopReserveLine(
  marchCountRaw: string,
  cityTroops: CityTroopStack[],
): MarchFormTroopReserveLineResult | null {
  const selected = parsePositiveIntMarchCount(marchCountRaw);
  if (selected == null) return null;
  const available = availableInfantryInCity(cityTroops);
  return formatMarchFormTroopReserveLine(selected, available);
}

/** 与 CLIENT-145 `validateMarchForm` 兵力口径一致：余量不足则禁用出征提交。 */
export function marchFormTroopReserveBlocksSubmit(
  reserve: MarchFormTroopReserveLineResult | null,
): boolean {
  return reserve?.insufficient === true;
}

export function marchFormAllowsSubmit(
  validation: ReturnType<typeof validateMarchForm>,
  reserve: MarchFormTroopReserveLineResult | null,
): boolean {
  return validation.ok && !marchFormTroopReserveBlocksSubmit(reserve);
}

export function syncMarchFormTroopReserveLine(
  formRoot: ParentNode | null | undefined,
  reserve: MarchFormTroopReserveLineResult | null,
): void {
  const el = formRoot?.querySelector<HTMLButtonElement>(
    `[data-role="${MARCH_FORM_TROOP_RESERVE_LINE_ROLE}"]`,
  );
  if (!el) return;

  if (!reserve?.line) {
    el.textContent = "";
    el.classList.add("hidden");
    el.classList.remove(MARCH_FORM_RESERVE_WARN_CLASS);
    el.disabled = true;
    el.removeAttribute("title");
    return;
  }

  el.textContent = reserve.line;
  el.classList.remove("hidden");
  el.classList.toggle(MARCH_FORM_RESERVE_WARN_CLASS, reserve.insufficient);
  el.disabled = !reserve.insufficient;
  if (reserve.insufficient) {
    el.title = "点击查看军情并定位相关行军";
  } else {
    el.removeAttribute("title");
  }
}

/** 同源 `march_id` 优先，否则目的格精确匹配，再否则曼哈顿最近终点行军。 */
export function resolveIntelMarchIdForMarchForm(
  marches: MarchSummary[],
  ctx: ScrollIntelRowForMarchFormContext,
): number | null {
  const preferred = ctx.preferredMarchId;
  if (preferred != null && preferred > 0) {
    const hit = marches.find((m) => m.march_id === preferred);
    if (hit?.march_id != null) return Math.trunc(hit.march_id);
  }

  const tx = ctx.toX;
  const ty = ctx.toY;
  if (tx == null || ty == null || !Number.isFinite(tx) || !Number.isFinite(ty)) {
    return null;
  }

  const exact = filterMarchesByDestination(marches, Math.trunc(tx), Math.trunc(ty));
  const exactId = exact[0]?.march_id;
  if (exactId != null && Number.isFinite(exactId)) return Math.trunc(exactId);

  let bestId: number | null = null;
  let bestDist: number | null = null;
  for (const m of marches) {
    const id = m.march_id;
    if (id == null || !Number.isFinite(id)) continue;
    const d = manhattanGridDistance(tx, ty, m.to_x, m.to_y);
    if (d == null) continue;
    if (bestDist == null || d < bestDist || (d === bestDist && id < (bestId ?? id))) {
      bestDist = d;
      bestId = Math.trunc(id);
    }
  }
  return bestId;
}

/**
 * 军情列表滚动并高亮与出征表单关联的行；返回解析到的 `march_id`（供场景打开军情选中）。
 */
export function scrollIntelRowForMarchForm(
  intelRoot: ParentNode | null | undefined,
  marches: MarchSummary[],
  ctx: ScrollIntelRowForMarchFormContext,
  options?: ScrollIntelRowForCoordsOptions,
): number | null {
  const marchId = resolveIntelMarchIdForMarchForm(marches, ctx);
  if (marchId == null) return null;

  const march = marches.find((m) => m.march_id === marchId);
  const tx = march?.to_x;
  const ty = march?.to_y;
  if (tx != null && ty != null && Number.isFinite(tx) && Number.isFinite(ty)) {
    scrollIntelRowForCoords(intelRoot, marches, Math.trunc(tx), Math.trunc(ty), options);
    return marchId;
  }

  const li = intelRoot?.querySelector<HTMLElement>(
    `.march-list li[data-march-id="${marchId}"]`,
  );
  if (li) {
    li.scrollIntoView?.({ block: "nearest" });
  }
  return marchId;
}

function parseWorldCoordForIntelContext(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  if (n < 0 || n > WORLD_MAP_COORD_MAX) return null;
  return n;
}

export function buildScrollIntelContextFromMarchForm(
  jumpMarchId: number | null,
  validationInput: Pick<MarchFormValidationInput, "toXRaw" | "toYRaw">,
): ScrollIntelRowForMarchFormContext {
  const toX = parseWorldCoordForIntelContext(validationInput.toXRaw);
  const toY = parseWorldCoordForIntelContext(validationInput.toYRaw);
  return {
    preferredMarchId: jumpMarchId,
    toX: toX != null && toY != null ? toX : null,
    toY: toX != null && toY != null ? toY : null,
  };
}
