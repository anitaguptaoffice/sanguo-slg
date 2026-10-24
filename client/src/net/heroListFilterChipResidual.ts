import {
  DEFAULT_HERO_LIST_FILTER,
  DEFAULT_HERO_LIST_SORT,
  heroListFilterLabel,
  heroListSortLabel,
  parseHeroListFilterSessionValue,
  parseHeroListSortSessionValue,
  type HeroListFilter,
  type HeroListSort,
} from "@/net/heroListFilter";

/** sessionStorage：筛选 chip 末次操作残余记忆（CLIENT-247；与 `hero-list-filter-v1` / CLIENT-231 并存）。 */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY = "hero-list-filter-chip-residual-v1";

export type HeroListFilterChipAction =
  | "hero-filter-all"
  | "hero-filter-deployable"
  | "hero-sort-level"
  | "hero-sort-loyalty";

const CHIP_ACTION_VALUES: readonly HeroListFilterChipAction[] = [
  "hero-filter-all",
  "hero-filter-deployable",
  "hero-sort-level",
  "hero-sort-loyalty",
];

export type HeroListFilterChipResidualPayload = {
  filter: HeroListFilter;
  sort: HeroListSort;
  lastChipAction?: HeroListFilterChipAction;
  updatedAtMs?: number;
};

export const HERO_LIST_FILTER_CHIP_RESIDUAL_SWEEP_CLASS = "hero-list-filter-chip-residual-sweep";
export const HERO_LIST_FILTER_CHIP_RESIDUAL_SWEEP_ROLE = "hero-list-filter-chip-residual-sweep";

export function parseHeroListFilterChipAction(
  raw: string | null | undefined,
): HeroListFilterChipAction | null {
  if (raw == null || raw === "") return null;
  if ((CHIP_ACTION_VALUES as readonly string[]).includes(raw)) {
    return raw as HeroListFilterChipAction;
  }
  return null;
}

export function heroListFilterChipActionLabel(action: HeroListFilterChipAction): string {
  switch (action) {
    case "hero-filter-all":
      return "全部";
    case "hero-filter-deployable":
      return "可出征";
    case "hero-sort-level":
      return "等级↓";
    case "hero-sort-loyalty":
      return "忠诚↓";
    default:
      return action;
  }
}

export function serializeHeroListFilterChipResidual(
  payload: HeroListFilterChipResidualPayload,
): string {
  return JSON.stringify({
    filter: payload.filter,
    sort: payload.sort,
    lastChipAction: payload.lastChipAction,
    updatedAtMs: payload.updatedAtMs,
  });
}

export function parseHeroListFilterChipResidual(
  raw: string | null | undefined,
): HeroListFilterChipResidualPayload | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed = JSON.parse(raw) as {
      filter?: unknown;
      sort?: unknown;
      lastChipAction?: unknown;
      updatedAtMs?: unknown;
    };
    const filter =
      parseHeroListFilterSessionValue(
        typeof parsed.filter === "string" ? parsed.filter : String(parsed.filter ?? ""),
      ) ?? DEFAULT_HERO_LIST_FILTER;
    const sort =
      parseHeroListSortSessionValue(
        typeof parsed.sort === "string" ? parsed.sort : String(parsed.sort ?? ""),
      ) ?? DEFAULT_HERO_LIST_SORT;
    const lastChipAction = parseHeroListFilterChipAction(
      typeof parsed.lastChipAction === "string" ? parsed.lastChipAction : null,
    );
    const updatedAtMs = Number(parsed.updatedAtMs);
    return {
      filter,
      sort,
      lastChipAction: lastChipAction ?? undefined,
      updatedAtMs: Number.isFinite(updatedAtMs) && updatedAtMs > 0 ? Math.trunc(updatedAtMs) : undefined,
    };
  } catch {
    return null;
  }
}

export function readHeroListFilterChipResidualSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): HeroListFilterChipResidualPayload | null {
  try {
    return parseHeroListFilterChipResidual(
      storage?.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

export function writeHeroListFilterChipResidualSession(
  payload: HeroListFilterChipResidualPayload,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  const parsed = parseHeroListFilterChipResidual(serializeHeroListFilterChipResidual(payload));
  if (!parsed) return;
  try {
    storage?.setItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY, serializeHeroListFilterChipResidual(parsed));
  } catch {
    /* quota / private mode */
  }
}

export function captureHeroListFilterChipResidual(
  filter: HeroListFilter,
  sort: HeroListSort,
  lastChipAction?: HeroListFilterChipAction,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  writeHeroListFilterChipResidualSession(
    {
      filter,
      sort,
      lastChipAction,
      updatedAtMs: Date.now(),
    },
    storage,
  );
}

export function formatHeroListFilterChipResidualSweepLine(
  payload: HeroListFilterChipResidualPayload | null | undefined,
): string | null {
  if (!payload) return null;
  const base = `${heroListFilterLabel(payload.filter)} · ${heroListSortLabel(payload.sort)}`;
  if (payload.lastChipAction) {
    return `筛选记忆 ${base}（末次 ${heroListFilterChipActionLabel(payload.lastChipAction)}）`;
  }
  return `筛选记忆 ${base}`;
}

export function syncHeroListFilterChipResidualSweep(
  heroPanel: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = heroPanel?.querySelector<HTMLElement>(
    `[data-role="${HERO_LIST_FILTER_CHIP_RESIDUAL_SWEEP_ROLE}"]`,
  );
  if (!el) return;
  if (!line?.trim()) {
    el.textContent = "";
    el.hidden = true;
    el.classList.add("hidden");
    return;
  }
  el.textContent = line;
  el.hidden = false;
  el.classList.remove("hidden");
}
