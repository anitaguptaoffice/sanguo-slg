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
import {
  applyHeroPanelListScrollTop,
  readHeroPanelListScrollTop,
} from "@/net/heroListSelectedSession";

/** sessionStorage：自列表进详情后返回时恢复筛选/排序/滚动/行高亮（CLIENT-199）。 */
export const HERO_LIST_RETURN_SESSION_KEY = "hero-list-return-v1";

export type HeroListReturnPayload = {
  filter: HeroListFilter;
  sort: HeroListSort;
  scrollTop: number;
  heroId: number;
};

export function serializeHeroListReturnState(payload: HeroListReturnPayload): string {
  const heroId = Number(payload.heroId);
  const scrollTop = Number(payload.scrollTop);
  return JSON.stringify({
    filter: payload.filter,
    sort: payload.sort,
    heroId: Math.trunc(heroId),
    scrollTop: Math.trunc(scrollTop),
  });
}

export function parseHeroListReturnState(
  raw: string | null | undefined,
): HeroListReturnPayload | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed = JSON.parse(raw) as {
      filter?: unknown;
      sort?: unknown;
      scrollTop?: unknown;
      heroId?: unknown;
    };
    const filter =
      parseHeroListFilterSessionValue(
        typeof parsed.filter === "string" ? parsed.filter : String(parsed.filter ?? ""),
      ) ?? DEFAULT_HERO_LIST_FILTER;
    const sort =
      parseHeroListSortSessionValue(
        typeof parsed.sort === "string" ? parsed.sort : String(parsed.sort ?? ""),
      ) ?? DEFAULT_HERO_LIST_SORT;
    const heroId = Number(parsed.heroId);
    const scrollTop = Number(parsed.scrollTop);
    if (!Number.isFinite(heroId) || heroId <= 0) return null;
    if (!Number.isFinite(scrollTop) || scrollTop < 0) return null;
    return {
      filter,
      sort,
      heroId: Math.trunc(heroId),
      scrollTop: Math.trunc(scrollTop),
    };
  } catch {
    return null;
  }
}

export function readHeroListReturnState(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): HeroListReturnPayload | null {
  try {
    return parseHeroListReturnState(storage?.getItem(HERO_LIST_RETURN_SESSION_KEY) ?? null);
  } catch {
    return null;
  }
}

export function writeHeroListReturnState(
  payload: HeroListReturnPayload,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  const parsed = parseHeroListReturnState(serializeHeroListReturnState(payload));
  if (!parsed) return;
  try {
    storage?.setItem(HERO_LIST_RETURN_SESSION_KEY, serializeHeroListReturnState(parsed));
  } catch {
    /* quota / private mode */
  }
}

export function clearHeroListReturnState(
  storage: Pick<Storage, "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.removeItem(HERO_LIST_RETURN_SESSION_KEY);
  } catch {
    /* quota / private mode */
  }
}

/** 详情顶栏：来源列表的筛选/排序摘要（CLIENT-199）。 */
export function formatHeroDetailFromListHint(
  ctx: Pick<HeroListReturnPayload, "filter" | "sort"> | null | undefined,
): string {
  if (!ctx) return "";
  return `来自列表：${heroListFilterLabel(ctx.filter)} · ${heroListSortLabel(ctx.sort)}`;
}

export function captureHeroListReturnPayload(
  heroPanel: ParentNode | null | undefined,
  filter: HeroListFilter,
  sort: HeroListSort,
  heroId: number,
): HeroListReturnPayload | null {
  const id = Number(heroId);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    filter,
    sort,
    heroId: Math.trunc(id),
    scrollTop: readHeroPanelListScrollTop(heroPanel),
  };
}

export function applyHeroListReturnScroll(
  heroPanel: ParentNode | null | undefined,
  scrollTop: number,
): void {
  applyHeroPanelListScrollTop(heroPanel, scrollTop);
}
