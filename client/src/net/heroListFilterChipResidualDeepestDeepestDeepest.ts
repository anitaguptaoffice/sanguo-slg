import {
  captureHeroListFilterChipResidualDeepestDeepestDeeper,
  formatHeroListFilterChipResidualDeepestDeepestDeeperSweepLine,
} from "@/net/heroListFilterChipResidualDeepestDeepestDeeper";
import {
  parseHeroListFilterChipResidual,
  serializeHeroListFilterChipResidual,
  type HeroListFilterChipAction,
  type HeroListFilterChipResidualPayload,
} from "@/net/heroListFilterChipResidual";
import type { HeroListFilter, HeroListSort } from "@/net/heroListFilter";

/** sessionStorage：筛选 chip 巩固再加深四层残余记忆（CLIENT-343；与 `hero-list-filter-chip-residual-deepest-deepest-deeper-v1` / CLIENT-327 并存）。 */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY =
  "hero-list-filter-chip-residual-deepest-deepest-deepest-v1";

export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS =
  "hero-list-filter-chip-residual-deepest-deepest-deepest-sweep";
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE =
  "hero-list-filter-chip-residual-deepest-deepest-deepest-sweep";

export function readHeroListFilterChipResidualDeepestDeepestDeepestSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): HeroListFilterChipResidualPayload | null {
  try {
    return parseHeroListFilterChipResidual(
      storage?.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

export function writeHeroListFilterChipResidualDeepestDeepestDeepestSession(
  payload: HeroListFilterChipResidualPayload,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  const parsed = parseHeroListFilterChipResidual(serializeHeroListFilterChipResidual(payload));
  if (!parsed) return;
  try {
    storage?.setItem(
      HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY,
      serializeHeroListFilterChipResidual(parsed),
    );
  } catch {
    /* quota / private mode */
  }
}

export function captureHeroListFilterChipResidualDeepestDeepestDeepest(
  filter: HeroListFilter,
  sort: HeroListSort,
  lastChipAction?: HeroListFilterChipAction,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  captureHeroListFilterChipResidualDeepestDeepestDeeper(filter, sort, lastChipAction, storage);
  writeHeroListFilterChipResidualDeepestDeepestDeepestSession(
    {
      filter,
      sort,
      lastChipAction,
      updatedAtMs: Date.now(),
    },
    storage,
  );
}

export function formatHeroListFilterChipResidualDeepestDeepestDeepestSweepLine(
  payload: HeroListFilterChipResidualPayload | null | undefined,
): string | null {
  const deepestDeepestDeeper = formatHeroListFilterChipResidualDeepestDeepestDeeperSweepLine(payload);
  if (!deepestDeepestDeeper) return null;
  return `筛选巩固再加深四层 · ${deepestDeepestDeeper} · 与 hero-list-filter-chip-residual-deepest-deepest-deeper-v1 并存 · CLIENT-231 返回高亮不退化`;
}

export function syncHeroListFilterChipResidualDeepestDeepestDeepestSweep(
  heroPanel: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = heroPanel?.querySelector<HTMLElement>(
    `[data-role="${HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_ROLE}"]`,
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
