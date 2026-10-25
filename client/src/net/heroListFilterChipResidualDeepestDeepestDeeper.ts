import {
  captureHeroListFilterChipResidualDeepestDeeper,
  formatHeroListFilterChipResidualDeepestDeeperSweepLine,
} from "@/net/heroListFilterChipResidualDeepestDeeper";
import {
  parseHeroListFilterChipResidual,
  serializeHeroListFilterChipResidual,
  type HeroListFilterChipAction,
  type HeroListFilterChipResidualPayload,
} from "@/net/heroListFilterChipResidual";
import type { HeroListFilter, HeroListSort } from "@/net/heroListFilter";

/** sessionStorage：筛选 chip 巩固再加深三层残余记忆（CLIENT-327；与 `hero-list-filter-chip-residual-deepest-deeper-v1` / CLIENT-311 并存）。 */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SESSION_KEY =
  "hero-list-filter-chip-residual-deepest-deepest-deeper-v1";

export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS =
  "hero-list-filter-chip-residual-deepest-deepest-deeper-sweep";
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE =
  "hero-list-filter-chip-residual-deepest-deepest-deeper-sweep";

export function readHeroListFilterChipResidualDeepestDeepestDeeperSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): HeroListFilterChipResidualPayload | null {
  try {
    return parseHeroListFilterChipResidual(
      storage?.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SESSION_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

export function writeHeroListFilterChipResidualDeepestDeepestDeeperSession(
  payload: HeroListFilterChipResidualPayload,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  const parsed = parseHeroListFilterChipResidual(serializeHeroListFilterChipResidual(payload));
  if (!parsed) return;
  try {
    storage?.setItem(
      HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SESSION_KEY,
      serializeHeroListFilterChipResidual(parsed),
    );
  } catch {
    /* quota / private mode */
  }
}

export function captureHeroListFilterChipResidualDeepestDeepestDeeper(
  filter: HeroListFilter,
  sort: HeroListSort,
  lastChipAction?: HeroListFilterChipAction,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  captureHeroListFilterChipResidualDeepestDeeper(filter, sort, lastChipAction, storage);
  writeHeroListFilterChipResidualDeepestDeepestDeeperSession(
    {
      filter,
      sort,
      lastChipAction,
      updatedAtMs: Date.now(),
    },
    storage,
  );
}

export function formatHeroListFilterChipResidualDeepestDeepestDeeperSweepLine(
  payload: HeroListFilterChipResidualPayload | null | undefined,
): string | null {
  const deepestDeeper = formatHeroListFilterChipResidualDeepestDeeperSweepLine(payload);
  if (!deepestDeeper) return null;
  return `筛选巩固再加深三层 · ${deepestDeeper} · 与 hero-list-filter-chip-residual-deepest-deeper-v1 并存 · CLIENT-231 返回高亮不退化`;
}

export function syncHeroListFilterChipResidualDeepestDeepestDeeperSweep(
  heroPanel: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = heroPanel?.querySelector<HTMLElement>(
    `[data-role="${HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE}"]`,
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
