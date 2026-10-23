/** sessionStorage：将领详情上次选中 hero_id（CLIENT-099；与 CLIENT-098 深链成功写入同一键）。 */
export const HERO_DETAIL_SELECTED_SESSION_KEY = "hero-detail-selected-id";

export function parseHeroDetailSelectedSessionValue(
  raw: string | null | undefined,
): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

export function readHeroDetailSelectedSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): number | null {
  try {
    return parseHeroDetailSelectedSessionValue(
      storage?.getItem(HERO_DETAIL_SELECTED_SESSION_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

export function writeHeroDetailSelectedSession(
  heroId: number,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  const id = parseHeroDetailSelectedSessionValue(String(heroId));
  if (id == null) return;
  try {
    storage?.setItem(HERO_DETAIL_SELECTED_SESSION_KEY, String(id));
  } catch {
    /* quota / private mode */
  }
}

/** 列表快照中仍存在的 stored id 才可恢复选中。 */
export function pickRestoredHeroId(
  heroes: readonly { hero_id?: number }[],
  storedId: number | null | undefined,
): number | null {
  if (storedId == null || storedId <= 0) return null;
  const exists = heroes.some((h) => h.hero_id === storedId);
  return exists ? storedId : null;
}
