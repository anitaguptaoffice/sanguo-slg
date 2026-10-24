/** sessionStorage：将领列表滚动与行选中（CLIENT-182；与 CLIENT-151 筛选排序键独立）。 */
export const HERO_LIST_SELECTED_SESSION_KEY = "hero-list-selected-v1";

export type HeroListSelectedPayload = {
  heroId: number;
  scrollTop: number;
};

export function parseHeroListSelectedSession(
  raw: string | null | undefined,
): HeroListSelectedPayload | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed = JSON.parse(raw) as { heroId?: unknown; scrollTop?: unknown };
    const heroId = Number(parsed.heroId);
    const scrollTop = Number(parsed.scrollTop);
    if (!Number.isFinite(heroId) || heroId <= 0) return null;
    if (!Number.isFinite(scrollTop) || scrollTop < 0) return null;
    return { heroId: Math.trunc(heroId), scrollTop: Math.trunc(scrollTop) };
  } catch {
    return null;
  }
}

export function readHeroListSelectedSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): HeroListSelectedPayload | null {
  try {
    return parseHeroListSelectedSession(storage?.getItem(HERO_LIST_SELECTED_SESSION_KEY) ?? null);
  } catch {
    return null;
  }
}

export function writeHeroListSelectedSession(
  payload: HeroListSelectedPayload,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  const heroId = Number(payload.heroId);
  const scrollTop = Number(payload.scrollTop);
  if (!Number.isFinite(heroId) || heroId <= 0 || !Number.isFinite(scrollTop) || scrollTop < 0) {
    return;
  }
  try {
    storage?.setItem(
      HERO_LIST_SELECTED_SESSION_KEY,
      JSON.stringify({ heroId: Math.trunc(heroId), scrollTop: Math.trunc(scrollTop) }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearHeroListSelectedSession(
  storage: Pick<Storage, "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.removeItem(HERO_LIST_SELECTED_SESSION_KEY);
  } catch {
    /* quota / private mode */
  }
}

export function heroPanelListScrollEl(heroPanel: ParentNode | null | undefined): HTMLElement | null {
  return heroPanel?.querySelector<HTMLElement>('[data-role="hero-scroll"]') ?? null;
}

export function readHeroPanelListScrollTop(heroPanel: ParentNode | null | undefined): number {
  return heroPanelListScrollEl(heroPanel)?.scrollTop ?? 0;
}

export function applyHeroPanelListScrollTop(
  heroPanel: ParentNode | null | undefined,
  scrollTop: number,
): void {
  const el = heroPanelListScrollEl(heroPanel);
  if (!el || !Number.isFinite(scrollTop) || scrollTop < 0) return;
  el.scrollTop = scrollTop;
}
