import {
  captureHeroListFilterChipResidualDeepest,
  formatHeroListFilterChipResidualDeepestSweepLine,
} from "@/net/heroListFilterChipResidualDeepest";
import {
  parseHeroListFilterChipResidual,
  serializeHeroListFilterChipResidual,
  type HeroListFilterChipAction,
  type HeroListFilterChipResidualPayload,
} from "@/net/heroListFilterChipResidual";
import type { HeroListFilter, HeroListSort } from "@/net/heroListFilter";

/** sessionStorage：筛选 chip 巩固再加深二层残余记忆（CLIENT-311；与 `hero-list-filter-chip-residual-deepest-v1` / CLIENT-295 并存）。 */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SESSION_KEY =
  "hero-list-filter-chip-residual-deepest-deeper-v1";

export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS =
  "hero-list-filter-chip-residual-deepest-deeper-sweep";
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SWEEP_ROLE =
  "hero-list-filter-chip-residual-deepest-deeper-sweep";

export function readHeroListFilterChipResidualDeepestDeeperSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): HeroListFilterChipResidualPayload | null {
  try {
    return parseHeroListFilterChipResidual(
      storage?.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SESSION_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

export function writeHeroListFilterChipResidualDeepestDeeperSession(
  payload: HeroListFilterChipResidualPayload,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  const parsed = parseHeroListFilterChipResidual(serializeHeroListFilterChipResidual(payload));
  if (!parsed) return;
  try {
    storage?.setItem(
      HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SESSION_KEY,
      serializeHeroListFilterChipResidual(parsed),
    );
  } catch {
    /* quota / private mode */
  }
}

export function captureHeroListFilterChipResidualDeepestDeeper(
  filter: HeroListFilter,
  sort: HeroListSort,
  lastChipAction?: HeroListFilterChipAction,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  captureHeroListFilterChipResidualDeepest(filter, sort, lastChipAction, storage);
  writeHeroListFilterChipResidualDeepestDeeperSession(
    {
      filter,
      sort,
      lastChipAction,
      updatedAtMs: Date.now(),
    },
    storage,
  );
}

export function formatHeroListFilterChipResidualDeepestDeeperSweepLine(
  payload: HeroListFilterChipResidualPayload | null | undefined,
): string | null {
  const deepest = formatHeroListFilterChipResidualDeepestSweepLine(payload);
  if (!deepest) return null;
  return `筛选巩固再加深二层 · ${deepest} · 与 hero-list-filter-chip-residual-deepest-v1 并存 · CLIENT-231 返回高亮不退化`;
}

export function syncHeroListFilterChipResidualDeepestDeeperSweep(
  heroPanel: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = heroPanel?.querySelector<HTMLElement>(
    `[data-role="${HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SWEEP_ROLE}"]`,
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
