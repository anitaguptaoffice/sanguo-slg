import { formatHeroLine, heroTemplateLabel, type HeroSummary } from "@/net/heroMailState";

/** 与 internal/hero/types.go Status* 对齐。 */
export const HERO_STATUS_IDLE = 1;
export const HERO_STATUS_GARRISON = 2;
export const HERO_STATUS_MARCH = 3;
export const HERO_STATUS_EXPR = 4;
export const HERO_STATUS_CITY_CHIEF = 5;

const HERO_STATUS_LABEL: Record<number, string> = {
  [HERO_STATUS_IDLE]: "空闲",
  [HERO_STATUS_GARRISON]: "驻守",
  [HERO_STATUS_MARCH]: "出征",
  [HERO_STATUS_EXPR]: "历练",
  [HERO_STATUS_CITY_CHIEF]: "城主",
};

export type MarchHeroRow = HeroSummary & {
  status?: number;
};

export function formatHeroStatusLabel(status: number | undefined): string {
  if (status == null || status === 0) return "空闲";
  return HERO_STATUS_LABEL[status] ?? `状态${status}`;
}

/** 服务端未下发 status 时视为未知，仍可选；已知非空闲则不可选。 */
export function isHeroSelectableForMarch(
  hero: MarchHeroRow,
  localBusyHeroIds?: ReadonlySet<number>,
): boolean {
  const id = hero.hero_id ?? 0;
  if (id > 0 && localBusyHeroIds?.has(id)) return false;
  const status = hero.status ?? 0;
  if (status === 0) return true;
  return status === HERO_STATUS_IDLE;
}

export function mapListPlayerHeroesForMarch(
  heroes: MarchHeroRow[] | undefined | null,
): MarchHeroRow[] {
  return (heroes ?? []).filter((h) => (h.hero_id ?? 0) > 0);
}

export function collectMarchBusyHeroIdsFromStatus(heroes: MarchHeroRow[]): Set<number> {
  const busy = new Set<number>();
  for (const h of heroes) {
    const id = h.hero_id ?? 0;
    if (id <= 0) continue;
    const status = h.status ?? 0;
    if (status !== 0 && status !== HERO_STATUS_IDLE) busy.add(id);
  }
  return busy;
}

export function formatMarchHeroOptionLabel(hero: MarchHeroRow, selectable: boolean): string {
  const base = formatHeroLine(hero);
  const status = hero.status ?? 0;
  if (selectable && (status === 0 || status === HERO_STATUS_IDLE)) return base;
  return `${base} · ${formatHeroStatusLabel(status)}`;
}

export type MarchHeroSelectOption = {
  heroId: number;
  label: string;
  selectable: boolean;
};

export function buildMarchHeroSelectOptions(
  heroes: MarchHeroRow[],
  localBusyHeroIds?: ReadonlySet<number>,
): MarchHeroSelectOption[] {
  const rows = mapListPlayerHeroesForMarch(heroes);
  return rows.map((h) => {
    const heroId = h.hero_id ?? 0;
    const selectable = isHeroSelectableForMarch(h, localBusyHeroIds);
    return {
      heroId,
      label: formatMarchHeroOptionLabel(h, selectable),
      selectable,
    };
  });
}

export type MarchHeroValidationInput = {
  heroIdRaw: string;
  ownedHeroes: MarchHeroRow[];
  localBusyHeroIds?: ReadonlySet<number>;
};

export type MarchHeroValidationOk = { ok: true; heroId: number };
export type MarchHeroValidationFail = { ok: false; message: string };
export type MarchHeroValidationResult = MarchHeroValidationOk | MarchHeroValidationFail;

export function validateMarchHeroSelection(
  input: MarchHeroValidationInput,
): MarchHeroValidationResult {
  const owned = mapListPlayerHeroesForMarch(input.ownedHeroes);
  if (!owned.length) {
    return { ok: false, message: "尚无将领可出征，请先在将领面板招募" };
  }
  const trimmed = input.heroIdRaw.trim();
  if (trimmed === "") {
    return { ok: false, message: "请选择带队将领" };
  }
  const heroId = Number(trimmed);
  if (!Number.isFinite(heroId) || !Number.isInteger(heroId) || heroId <= 0) {
    return { ok: false, message: "请选择有效的将领" };
  }
  const hero = owned.find((h) => h.hero_id === heroId);
  if (!hero) {
    return { ok: false, message: "将领不存在或不属于您" };
  }
  if (!isHeroSelectableForMarch(hero, input.localBusyHeroIds)) {
    const name = heroTemplateLabel(hero.template_cfg_id);
    const statusLabel = formatHeroStatusLabel(hero.status);
    return { ok: false, message: `将领 ${name} 当前为「${statusLabel}」，仅空闲将领可出征` };
  }
  return { ok: true, heroId };
}

export const MARCH_HERO_SELECT_FIELD = "march-hero";

export function readMarchHeroIdRaw(formRoot: ParentNode | null | undefined): string {
  const el = formRoot?.querySelector(
    `[data-field="${MARCH_HERO_SELECT_FIELD}"]`,
  ) as HTMLSelectElement | null;
  return el?.value ?? "";
}

export function syncMarchHeroSelect(
  formRoot: ParentNode | null | undefined,
  heroes: MarchHeroRow[],
  localBusyHeroIds?: ReadonlySet<number>,
): void {
  const select = formRoot?.querySelector(
    `[data-field="${MARCH_HERO_SELECT_FIELD}"]`,
  ) as HTMLSelectElement | null;
  if (!select) return;

  const previous = select.value;
  const options = buildMarchHeroSelectOptions(heroes, localBusyHeroIds);

  select.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = options.some((o) => o.selectable)
    ? "选择空闲将领…"
    : "暂无空闲将领";
  select.appendChild(placeholder);

  for (const opt of options) {
    const el = document.createElement("option");
    el.value = String(opt.heroId);
    el.textContent = opt.label;
    el.disabled = !opt.selectable;
    select.appendChild(el);
  }

  const stillValid =
    previous !== "" && options.some((o) => o.selectable && String(o.heroId) === previous);
  if (stillValid) {
    select.value = previous;
  } else {
    const firstIdle = options.find((o) => o.selectable);
    select.value = firstIdle ? String(firstIdle.heroId) : "";
  }
}

/** 将网关英文 hero 相关报错转为可读中文（CLIENT-067 march 域）。 */
export function normalizeMarchHeroGatewayMessage(msg: string): string {
  const lower = msg.trim().toLowerCase();
  if (!lower) return msg;
  if (lower.includes("hero_id required")) return "请选择带队将领";
  if (lower.includes("hero not found")) return "将领不存在或不属于您";
  if (lower.includes("not idle") || lower.includes("hero is not idle")) {
    return "将领当前非空闲，无法出征";
  }
  return msg;
}
