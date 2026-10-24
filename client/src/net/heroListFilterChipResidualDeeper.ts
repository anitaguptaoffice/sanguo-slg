import {
  captureHeroListFilterChipResidualDeep,
  formatHeroListFilterChipResidualDeepSweepLine,
} from "@/net/heroListFilterChipResidualDeep";
import {
  parseHeroListFilterChipResidual,
  serializeHeroListFilterChipResidual,
  type HeroListFilterChipAction,
  type HeroListFilterChipResidualPayload,
} from "@/net/heroListFilterChipResidual";
import type { HeroListFilter, HeroListSort } from "@/net/heroListFilter";

/** sessionStorage：筛选 chip 巩固再加深残余记忆（CLIENT-279；与 `hero-list-filter-chip-residual-deep-v1` / CLIENT-263 并存）。 */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY =
  "hero-list-filter-chip-residual-deeper-v1";

export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SWEEP_CLASS =
  "hero-list-filter-chip-residual-deeper-sweep";
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SWEEP_ROLE =
  "hero-list-filter-chip-residual-deeper-sweep";

export function readHeroListFilterChipResidualDeeperSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): HeroListFilterChipResidualPayload | null {
  try {
    return parseHeroListFilterChipResidual(
      storage?.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

export function writeHeroListFilterChipResidualDeeperSession(
  payload: HeroListFilterChipResidualPayload,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  const parsed = parseHeroListFilterChipResidual(serializeHeroListFilterChipResidual(payload));
  if (!parsed) return;
  try {
    storage?.setItem(
      HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY,
      serializeHeroListFilterChipResidual(parsed),
    );
  } catch {
    /* quota / private mode */
  }
}

export function captureHeroListFilterChipResidualDeeper(
  filter: HeroListFilter,
  sort: HeroListSort,
  lastChipAction?: HeroListFilterChipAction,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  captureHeroListFilterChipResidualDeep(filter, sort, lastChipAction, storage);
  writeHeroListFilterChipResidualDeeperSession(
    {
      filter,
      sort,
      lastChipAction,
      updatedAtMs: Date.now(),
    },
    storage,
  );
}

export function formatHeroListFilterChipResidualDeeperSweepLine(
  payload: HeroListFilterChipResidualPayload | null | undefined,
): string | null {
  const deep = formatHeroListFilterChipResidualDeepSweepLine(payload);
  if (!deep) return null;
  return `筛选巩固再加深 · ${deep} · 与 hero-list-filter-chip-residual-deep-v1 并存 · CLIENT-231 返回高亮不退化`;
}

export function syncHeroListFilterChipResidualDeeperSweep(
  heroPanel: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = heroPanel?.querySelector<HTMLElement>(
    `[data-role="${HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SWEEP_ROLE}"]`,
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
