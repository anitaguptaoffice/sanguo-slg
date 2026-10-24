import {
  captureHeroListFilterChipResidual,
  formatHeroListFilterChipResidualSweepLine,
  parseHeroListFilterChipResidual,
  serializeHeroListFilterChipResidual,
  type HeroListFilterChipAction,
  type HeroListFilterChipResidualPayload,
} from "@/net/heroListFilterChipResidual";
import type { HeroListFilter, HeroListSort } from "@/net/heroListFilter";

/** sessionStorage：筛选 chip 深化残余记忆（CLIENT-263；与 `hero-list-filter-chip-residual-v1` / CLIENT-247 并存）。 */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY =
  "hero-list-filter-chip-residual-deep-v1";

export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SWEEP_CLASS =
  "hero-list-filter-chip-residual-deep-sweep";
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SWEEP_ROLE =
  "hero-list-filter-chip-residual-deep-sweep";

export function readHeroListFilterChipResidualDeepSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): HeroListFilterChipResidualPayload | null {
  try {
    return parseHeroListFilterChipResidual(
      storage?.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

export function writeHeroListFilterChipResidualDeepSession(
  payload: HeroListFilterChipResidualPayload,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  const parsed = parseHeroListFilterChipResidual(serializeHeroListFilterChipResidual(payload));
  if (!parsed) return;
  try {
    storage?.setItem(
      HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY,
      serializeHeroListFilterChipResidual(parsed),
    );
  } catch {
    /* quota / private mode */
  }
}

export function captureHeroListFilterChipResidualDeep(
  filter: HeroListFilter,
  sort: HeroListSort,
  lastChipAction?: HeroListFilterChipAction,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  captureHeroListFilterChipResidual(filter, sort, lastChipAction, storage);
  writeHeroListFilterChipResidualDeepSession(
    {
      filter,
      sort,
      lastChipAction,
      updatedAtMs: Date.now(),
    },
    storage,
  );
}

export function formatHeroListFilterChipResidualDeepSweepLine(
  payload: HeroListFilterChipResidualPayload | null | undefined,
): string | null {
  const base = formatHeroListFilterChipResidualSweepLine(payload);
  if (!base) return null;
  return `筛选巩固 · ${base} · 与 hero-list-filter-chip-residual-v1 并存 · 返回高亮不退化`;
}

export function syncHeroListFilterChipResidualDeepSweep(
  heroPanel: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = heroPanel?.querySelector<HTMLElement>(
    `[data-role="${HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SWEEP_ROLE}"]`,
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
