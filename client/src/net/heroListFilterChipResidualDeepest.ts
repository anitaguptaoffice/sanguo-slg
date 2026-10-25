import {
  captureHeroListFilterChipResidualDeeper,
  formatHeroListFilterChipResidualDeeperSweepLine,
} from "@/net/heroListFilterChipResidualDeeper";
import {
  parseHeroListFilterChipResidual,
  serializeHeroListFilterChipResidual,
  type HeroListFilterChipAction,
  type HeroListFilterChipResidualPayload,
} from "@/net/heroListFilterChipResidual";
import type { HeroListFilter, HeroListSort } from "@/net/heroListFilter";

/** sessionStorage：筛选 chip 巩固再加深一层残余记忆（CLIENT-295；与 `hero-list-filter-chip-residual-deeper-v1` / CLIENT-279 并存）。 */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY =
  "hero-list-filter-chip-residual-deepest-v1";

export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SWEEP_CLASS =
  "hero-list-filter-chip-residual-deepest-sweep";
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SWEEP_ROLE =
  "hero-list-filter-chip-residual-deepest-sweep";

export function readHeroListFilterChipResidualDeepestSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): HeroListFilterChipResidualPayload | null {
  try {
    return parseHeroListFilterChipResidual(
      storage?.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

export function writeHeroListFilterChipResidualDeepestSession(
  payload: HeroListFilterChipResidualPayload,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  const parsed = parseHeroListFilterChipResidual(serializeHeroListFilterChipResidual(payload));
  if (!parsed) return;
  try {
    storage?.setItem(
      HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY,
      serializeHeroListFilterChipResidual(parsed),
    );
  } catch {
    /* quota / private mode */
  }
}

export function captureHeroListFilterChipResidualDeepest(
  filter: HeroListFilter,
  sort: HeroListSort,
  lastChipAction?: HeroListFilterChipAction,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  captureHeroListFilterChipResidualDeeper(filter, sort, lastChipAction, storage);
  writeHeroListFilterChipResidualDeepestSession(
    {
      filter,
      sort,
      lastChipAction,
      updatedAtMs: Date.now(),
    },
    storage,
  );
}

export function formatHeroListFilterChipResidualDeepestSweepLine(
  payload: HeroListFilterChipResidualPayload | null | undefined,
): string | null {
  const deeper = formatHeroListFilterChipResidualDeeperSweepLine(payload);
  if (!deeper) return null;
  return `筛选巩固再加深一层 · ${deeper} · 与 hero-list-filter-chip-residual-deeper-v1 并存 · CLIENT-231 返回高亮不退化`;
}

export function syncHeroListFilterChipResidualDeepestSweep(
  heroPanel: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = heroPanel?.querySelector<HTMLElement>(
    `[data-role="${HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SWEEP_ROLE}"]`,
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
