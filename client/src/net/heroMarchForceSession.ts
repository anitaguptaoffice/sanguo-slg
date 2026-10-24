/** sessionStorage：将领出征体力快照（CLIENT-hero-force-001；详情加载/休整后写入，出征表单只读校验）。 */
export const HERO_MARCH_FORCE_SESSION_KEY = "rxsg.client.heroMarchForce.v1";

export type HeroMarchForceSessionEntry = {
  current: number;
  max: number;
  updatedAtMs: number;
};

export type HeroMarchForceSessionMap = Record<string, HeroMarchForceSessionEntry>;

function parseSessionMap(raw: string | null): HeroMarchForceSessionMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as HeroMarchForceSessionMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function readHeroMarchForceSession(
  heroId: number,
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): HeroMarchForceSessionEntry | null {
  if (!storage || !Number.isFinite(heroId) || heroId <= 0) return null;
  const map = parseSessionMap(storage.getItem(HERO_MARCH_FORCE_SESSION_KEY));
  const entry = map[String(heroId)];
  if (!entry || typeof entry !== "object") return null;
  const current = Number(entry.current);
  const max = Number(entry.max);
  if (!Number.isFinite(current) || !Number.isFinite(max)) return null;
  return { current, max, updatedAtMs: Number(entry.updatedAtMs) || 0 };
}

export function writeHeroMarchForceSession(
  heroId: number,
  current: number,
  max: number,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  if (!storage || !Number.isFinite(heroId) || heroId <= 0) return;
  const map = parseSessionMap(storage.getItem(HERO_MARCH_FORCE_SESSION_KEY));
  map[String(heroId)] = { current, max, updatedAtMs: Date.now() };
  storage.setItem(HERO_MARCH_FORCE_SESSION_KEY, JSON.stringify(map));
}

export function clearHeroMarchForceSession(
  heroId: number,
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  if (!storage || !Number.isFinite(heroId) || heroId <= 0) return;
  const map = parseSessionMap(storage.getItem(HERO_MARCH_FORCE_SESSION_KEY));
  delete map[String(heroId)];
  storage.setItem(HERO_MARCH_FORCE_SESSION_KEY, JSON.stringify(map));
}
