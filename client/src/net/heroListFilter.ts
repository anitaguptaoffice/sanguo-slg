import type { HeroSummary } from "@/net/heroMailState";

/** sessionStorage：将领列表筛选（CLIENT-151，仅客户端）。 */
export const HERO_LIST_FILTER_SESSION_KEY = "hero-list-filter-v1";

/** sessionStorage：将领列表排序（CLIENT-151，仅客户端）。 */
export const HERO_LIST_SORT_SESSION_KEY = "hero-list-sort-v1";

export type HeroListFilter = "all" | "deployable";

export type HeroListSort = "level_desc" | "loyalty_desc";

export const DEFAULT_HERO_LIST_FILTER: HeroListFilter = "all";

export const DEFAULT_HERO_LIST_SORT: HeroListSort = "level_desc";

/**
 * 列表 RPC 无行军占用字段时的「可出征」等价口径：忠诚不低于该阈值。
 * 详情 `loyalty_min` 更高时以详情为准（见 {@link heroMatchesDeployableFilter}）。
 */
export const HERO_LIST_DEPLOYABLE_MIN_LOYALTY = 30;

const FILTER_VALUES: readonly HeroListFilter[] = ["all", "deployable"];

const SORT_VALUES: readonly HeroListSort[] = ["level_desc", "loyalty_desc"];

export type HeroListFilterContext = {
  /** 已加载详情时用于更精确的忠诚下限。 */
  detailLoyaltyMinByHeroId?: ReadonlyMap<number, number>;
};

export function parseHeroListFilterSessionValue(
  raw: string | null | undefined,
): HeroListFilter | null {
  if (raw == null || raw === "") return null;
  if ((FILTER_VALUES as readonly string[]).includes(raw)) {
    return raw as HeroListFilter;
  }
  return null;
}

export function parseHeroListSortSessionValue(raw: string | null | undefined): HeroListSort | null {
  if (raw == null || raw === "") return null;
  if ((SORT_VALUES as readonly string[]).includes(raw)) {
    return raw as HeroListSort;
  }
  return null;
}

export function readHeroListFilterSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): HeroListFilter {
  try {
    return (
      parseHeroListFilterSessionValue(storage?.getItem(HERO_LIST_FILTER_SESSION_KEY) ?? null) ??
      DEFAULT_HERO_LIST_FILTER
    );
  } catch {
    return DEFAULT_HERO_LIST_FILTER;
  }
}

export function readHeroListSortSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): HeroListSort {
  try {
    return (
      parseHeroListSortSessionValue(storage?.getItem(HERO_LIST_SORT_SESSION_KEY) ?? null) ??
      DEFAULT_HERO_LIST_SORT
    );
  } catch {
    return DEFAULT_HERO_LIST_SORT;
  }
}

export function writeHeroListFilterSession(
  filter: HeroListFilter,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.setItem(HERO_LIST_FILTER_SESSION_KEY, filter);
  } catch {
    /* quota / private mode */
  }
}

export function writeHeroListSortSession(
  sort: HeroListSort,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.setItem(HERO_LIST_SORT_SESSION_KEY, sort);
  } catch {
    /* quota / private mode */
  }
}

export function heroListFilterLabel(filter: HeroListFilter): string {
  switch (filter) {
    case "all":
      return "全部";
    case "deployable":
      return "可出征";
    default:
      return filter;
  }
}

export function heroListSortLabel(sort: HeroListSort): string {
  switch (sort) {
    case "level_desc":
      return "等级↓";
    case "loyalty_desc":
      return "忠诚↓";
    default:
      return sort;
  }
}

function deployableMinLoyalty(
  hero: HeroSummary,
  ctx?: HeroListFilterContext,
): number {
  const id = hero.hero_id ?? 0;
  const fromDetail = id > 0 ? ctx?.detailLoyaltyMinByHeroId?.get(id) : undefined;
  if (fromDetail != null && Number.isFinite(fromDetail)) {
    return Math.max(HERO_LIST_DEPLOYABLE_MIN_LOYALTY, fromDetail);
  }
  return HERO_LIST_DEPLOYABLE_MIN_LOYALTY;
}

export function heroMatchesDeployableFilter(
  hero: HeroSummary,
  ctx?: HeroListFilterContext,
): boolean {
  const loyalty = hero.loyalty ?? 0;
  return loyalty >= deployableMinLoyalty(hero, ctx);
}

export function filterHeroListRows(
  rows: HeroSummary[],
  filter: HeroListFilter,
  ctx?: HeroListFilterContext,
): HeroSummary[] {
  if (filter === "all") return rows.slice();
  return rows.filter((h) => heroMatchesDeployableFilter(h, ctx));
}

export function sortHeroListRows(rows: HeroSummary[], sort: HeroListSort): HeroSummary[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    if (sort === "level_desc") {
      const byLevel = (b.level ?? 0) - (a.level ?? 0);
      if (byLevel !== 0) return byLevel;
      const byLoyalty = (b.loyalty ?? 0) - (a.loyalty ?? 0);
      if (byLoyalty !== 0) return byLoyalty;
    } else {
      const byLoyalty = (b.loyalty ?? 0) - (a.loyalty ?? 0);
      if (byLoyalty !== 0) return byLoyalty;
      const byLevel = (b.level ?? 0) - (a.level ?? 0);
      if (byLevel !== 0) return byLevel;
    }
    return (a.hero_id ?? 0) - (b.hero_id ?? 0);
  });
  return copy;
}

export function heroListRowsForDisplay(
  rows: HeroSummary[],
  filter: HeroListFilter,
  sort: HeroListSort,
  ctx?: HeroListFilterContext,
): HeroSummary[] {
  return sortHeroListRows(filterHeroListRows(rows, filter, ctx), sort);
}

export function heroListFilteredEmptyMessage(filter: HeroListFilter): string {
  if (filter === "all") {
    return "（尚无将领，可尝试招募）";
  }
  return `（当前「${heroListFilterLabel(filter)}」筛选无匹配将领）`;
}
