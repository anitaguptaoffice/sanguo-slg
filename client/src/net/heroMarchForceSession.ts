/** sessionStorage：将领出征体力快照（CLIENT-hero-force-001；详情加载/休整后写入，出征表单只读校验）。 */
export const HERO_MARCH_FORCE_SESSION_KEY = "rxsg.client.heroMarchForce.v1";

export type HeroMarchForceSessionEntry = {
  current: number;
  max: number;
  updatedAtMs: number;
};

export type HeroMarchForceSessionMap = Record<string, HeroMarchForceSessionEntry>;

// The default scope survives storage getter failures; explicit stores stay isolated.
const defaultScope = {};
const revisions = new WeakMap<object, Map<number, number>>();
const invalidated = new WeakMap<object, Set<number>>();
export function heroMarchForceSessionRevision(heroId: number, storage: object | null = defaultScope): number {
  return storage ? revisions.get(storage)?.get(heroId) ?? 0 : 0;
}
function advanceRevision(storage: object, heroId: number): void {
  let map = revisions.get(storage);
  if (!map) { map = new Map(); revisions.set(storage, map); }
  map.set(heroId, (map.get(heroId) ?? 0) + 1);
}

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
  storage?: Pick<Storage, "getItem"> | null,
): HeroMarchForceSessionEntry | null {
  if (storage === null || !Number.isFinite(heroId) || heroId <= 0) return null;
  if (invalidated.get(storage ?? defaultScope)?.has(heroId)) return null;
  try {
    const target = storage ?? (typeof sessionStorage !== "undefined" ? sessionStorage : null);
    if (!target) return null;
    const entry = parseSessionMap(target.getItem(HERO_MARCH_FORCE_SESSION_KEY))[String(heroId)];
    if (!entry || typeof entry !== "object") return null;
    const current = Number(entry.current);
    const max = Number(entry.max);
    if (!Number.isFinite(current) || !Number.isFinite(max)) return null;
    return { current, max, updatedAtMs: Number(entry.updatedAtMs) || 0 };
  } catch {
    return null; // Optional cache access must not block server validation.
  }
}

function updateSession(heroId: number, entry: HeroMarchForceSessionEntry | null,
  storage?: Pick<Storage, "getItem" | "setItem"> | null): void {
  if (storage === null || !Number.isFinite(heroId) || heroId <= 0) return;
  const scope = storage ?? defaultScope;
  let stale = invalidated.get(scope);
  if (!stale) { stale = new Set(); invalidated.set(scope, stale); }
  // An accepted observation supersedes old data even if persistence fails.
  advanceRevision(scope, heroId);
  stale.add(heroId);
  try {
    const target = storage ?? (typeof sessionStorage !== "undefined" ? sessionStorage : null);
    if (!target) return;
    const map = parseSessionMap(target.getItem(HERO_MARCH_FORCE_SESSION_KEY));
    if (entry) map[String(heroId)] = entry;
    else delete map[String(heroId)];
    target.setItem(HERO_MARCH_FORCE_SESSION_KEY, JSON.stringify(map));
    stale.delete(heroId);
  } catch {
    // Keep a tombstone: a previously persisted low value must not regain authority.
  }
}

export function writeHeroMarchForceSession(
  heroId: number,
  current: number,
  max: number,
  storage?: Pick<Storage, "getItem" | "setItem"> | null,
): void {
  updateSession(heroId, { current, max, updatedAtMs: Date.now() }, storage);
}

export function clearHeroMarchForceSession(
  heroId: number,
  storage?: Pick<Storage, "getItem" | "setItem"> | null,
): void {
  updateSession(heroId, null, storage);
}
