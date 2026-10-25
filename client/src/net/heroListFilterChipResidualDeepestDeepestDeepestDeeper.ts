import {
  captureHeroListFilterChipResidualDeepestDeepestDeepestDeepest,
  formatHeroListFilterChipResidualDeepestDeepestDeepestDeepestSweepLine,
} from "@/net/heroListFilterChipResidualDeepestDeepestDeepestDeepest";
import {
  parseHeroListFilterChipResidual,
  serializeHeroListFilterChipResidual,
  type HeroListFilterChipAction,
  type HeroListFilterChipResidualPayload,
} from "@/net/heroListFilterChipResidual";
import type { HeroListFilter, HeroListSort } from "@/net/heroListFilter";

/** sessionStorage：筛选 chip 巩固再加深五层残余记忆（CLIENT-375；与 `hero-list-filter-chip-residual-deepest-deepest-deepest-deepest-v1` / CLIENT-375 并存）。 */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SESSION_KEY =
  "hero-list-filter-chip-residual-deepest-deepest-deepest-deeper-v1";

export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS =
  "hero-list-filter-chip-residual-deepest-deepest-deepest-deeper-sweep";
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE =
  "hero-list-filter-chip-residual-deepest-deepest-deepest-deeper-sweep";

export function readHeroListFilterChipResidualDeepestDeepestDeepestDeeperSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): HeroListFilterChipResidualPayload | null {
  try {
    return parseHeroListFilterChipResidual(
      storage?.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SESSION_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

export function writeHeroListFilterChipResidualDeepestDeepestDeepestDeeperSession(
  payload: HeroListFilterChipResidualPayload,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  const parsed = parseHeroListFilterChipResidual(serializeHeroListFilterChipResidual(payload));
  if (!parsed) return;
  try {
    storage?.setItem(
      HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SESSION_KEY,
      serializeHeroListFilterChipResidual(parsed),
    );
  } catch {
    /* quota / private mode */
  }
}

export function captureHeroListFilterChipResidualDeepestDeepestDeepestDeeper(
  filter: HeroListFilter,
  sort: HeroListSort,
  lastChipAction?: HeroListFilterChipAction,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  captureHeroListFilterChipResidualDeepestDeepestDeepestDeepest(filter, sort, lastChipAction, storage);
  writeHeroListFilterChipResidualDeepestDeepestDeepestDeeperSession(
    {
      filter,
      sort,
      lastChipAction,
      updatedAtMs: Date.now(),
    },
    storage,
  );
}

export function formatHeroListFilterChipResidualDeepestDeepestDeepestDeeperSweepLine(
  payload: HeroListFilterChipResidualPayload | null | undefined,
): string | null {
  const deepestDeepestDeepestDeepest = formatHeroListFilterChipResidualDeepestDeepestDeepestDeepestSweepLine(
    payload,
  );
  if (!deepestDeepestDeepestDeepest) return null;
  return `筛选巩固再加深五层 · ${deepestDeepestDeepestDeepest} · 与 hero-list-filter-chip-residual-deepest-deepest-deepest-deepest-v1 并存 · CLIENT-231 返回高亮不退化`;
}

export function syncHeroListFilterChipResidualDeepestDeepestDeepestDeeperSweep(
  heroPanel: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = heroPanel?.querySelector<HTMLElement>(
    `[data-role="${HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_ROLE}"]`,
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
