import { describe, expect, it, beforeEach } from "vitest";
import type { HeroSummary } from "@/net/heroMailState";
import {
  DEFAULT_HERO_LIST_FILTER,
  DEFAULT_HERO_LIST_SORT,
  filterHeroListRows,
  HERO_LIST_DEPLOYABLE_MIN_LOYALTY,
  HERO_LIST_FILTER_SESSION_KEY,
  HERO_LIST_SORT_SESSION_KEY,
  heroListFilteredEmptyMessage,
  heroListRowsForDisplay,
  heroMatchesDeployableFilter,
  parseHeroListFilterSessionValue,
  parseHeroListSortSessionValue,
  readHeroListFilterSession,
  readHeroListSortSession,
  sortHeroListRows,
  writeHeroListFilterSession,
  writeHeroListSortSession,
} from "@/net/heroListFilter";

function mockStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: () => null,
    length: 0,
  } as Storage;
}

const heroes: HeroSummary[] = [
  { hero_id: 1, template_cfg_id: 1001, level: 5, loyalty: 80 },
  { hero_id: 2, template_cfg_id: 1002, level: 10, loyalty: 20 },
  { hero_id: 3, template_cfg_id: 1003, level: 8, loyalty: 55 },
];

describe("heroListFilter", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = mockStorage();
  });

  it("filterHeroListRows keeps all or deployable by loyalty threshold", () => {
    expect(filterHeroListRows(heroes, "all").length).toBe(3);
    const deployable = filterHeroListRows(heroes, "deployable");
    expect(deployable.map((h) => h.hero_id)).toEqual([1, 3]);
    expect(HERO_LIST_DEPLOYABLE_MIN_LOYALTY).toBe(30);
    expect(
      heroMatchesDeployableFilter(
        { hero_id: 9, loyalty: HERO_LIST_DEPLOYABLE_MIN_LOYALTY - 1 },
        undefined,
      ),
    ).toBe(false);
  });

  it("deployable respects detail loyalty_min when higher than default", () => {
    const ctx = { detailLoyaltyMinByHeroId: new Map([[1, 85]]) };
    expect(heroMatchesDeployableFilter(heroes[0], ctx)).toBe(false);
    expect(heroMatchesDeployableFilter({ ...heroes[0], loyalty: 90 }, ctx)).toBe(true);
  });

  it("sortHeroListRows orders by level or loyalty descending", () => {
    expect(sortHeroListRows(heroes, "level_desc").map((h) => h.hero_id)).toEqual([2, 3, 1]);
    expect(sortHeroListRows(heroes, "loyalty_desc").map((h) => h.hero_id)).toEqual([1, 3, 2]);
  });

  it("heroListRowsForDisplay applies filter then sort", () => {
    const visible = heroListRowsForDisplay(heroes, "deployable", "loyalty_desc");
    expect(visible.map((h) => h.hero_id)).toEqual([1, 3]);
  });

  it("persists filter and sort in separate sessionStorage keys", () => {
    writeHeroListFilterSession("deployable", storage);
    writeHeroListSortSession("loyalty_desc", storage);
    expect(storage.getItem(HERO_LIST_FILTER_SESSION_KEY)).toBe("deployable");
    expect(storage.getItem(HERO_LIST_SORT_SESSION_KEY)).toBe("loyalty_desc");
    expect(readHeroListFilterSession(storage)).toBe("deployable");
    expect(readHeroListSortSession(storage)).toBe("loyalty_desc");
  });

  it("parse session values rejects invalid payloads", () => {
    expect(parseHeroListFilterSessionValue(null)).toBeNull();
    expect(parseHeroListFilterSessionValue("nope")).toBeNull();
    expect(parseHeroListSortSessionValue("level_desc")).toBe("level_desc");
    expect(parseHeroListSortSessionValue("eta_asc")).toBeNull();
  });

  it("falls back to defaults when session missing", () => {
    expect(readHeroListFilterSession(storage)).toBe(DEFAULT_HERO_LIST_FILTER);
    expect(readHeroListSortSession(storage)).toBe(DEFAULT_HERO_LIST_SORT);
  });

  it("heroListFilteredEmptyMessage differs for deployable filter", () => {
    expect(heroListFilteredEmptyMessage("deployable")).toContain("可出征");
  });
});
