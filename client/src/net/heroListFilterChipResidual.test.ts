import { beforeEach, describe, expect, it } from "vitest";
import {
  captureHeroListFilterChipResidual,
  formatHeroListFilterChipResidualSweepLine,
  HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY,
  readHeroListFilterChipResidualSession,
  serializeHeroListFilterChipResidual,
} from "@/net/heroListFilterChipResidual";
import { HERO_LIST_FILTER_SESSION_KEY } from "@/net/heroListFilter";

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

describe("heroListFilterChipResidual (CLIENT-247)", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = mockStorage();
  });

  it("persists hero-list-filter-chip-residual-v1 alongside hero-list-filter-v1", () => {
    storage.setItem(HERO_LIST_FILTER_SESSION_KEY, "deployable");
    captureHeroListFilterChipResidual("deployable", "loyalty_desc", "hero-filter-deployable", storage);
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_SESSION_KEY)).toBe("deployable");
    const payload = readHeroListFilterChipResidualSession(storage);
    expect(payload?.filter).toBe("deployable");
    expect(payload?.sort).toBe("loyalty_desc");
    expect(payload?.lastChipAction).toBe("hero-filter-deployable");
  });

  it("formatHeroListFilterChipResidualSweepLine includes last chip action", () => {
    const line = formatHeroListFilterChipResidualSweepLine({
      filter: "all",
      sort: "level_desc",
      lastChipAction: "hero-sort-level",
    });
    expect(line).toContain("等级↓");
    expect(line).toContain("末次");
  });

  it("serialize round-trips invalid chip action", () => {
    const raw = serializeHeroListFilterChipResidual({
      filter: "all",
      sort: "level_desc",
      lastChipAction: "hero-filter-all",
    });
    expect(raw).toContain("hero-filter-all");
  });
});
