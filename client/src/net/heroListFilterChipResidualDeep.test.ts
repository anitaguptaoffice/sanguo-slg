import { beforeEach, describe, expect, it } from "vitest";
import {
  captureHeroListFilterChipResidualDeep,
  formatHeroListFilterChipResidualDeepSweepLine,
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY,
  readHeroListFilterChipResidualDeepSession,
} from "@/net/heroListFilterChipResidualDeep";
import {
  HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY,
  readHeroListFilterChipResidualSession,
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

describe("heroListFilterChipResidualDeep (CLIENT-263)", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = mockStorage();
  });

  it("persists hero-list-filter-chip-residual-deep-v1 alongside v1 and filter session", () => {
    storage.setItem(HERO_LIST_FILTER_SESSION_KEY, "deployable");
    captureHeroListFilterChipResidualDeep(
      "deployable",
      "loyalty_desc",
      "hero-filter-deployable",
      storage,
    );
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_SESSION_KEY)).toBe("deployable");
    const deep = readHeroListFilterChipResidualDeepSession(storage);
    expect(deep?.filter).toBe("deployable");
    expect(deep?.lastChipAction).toBe("hero-filter-deployable");
    expect(readHeroListFilterChipResidualSession(storage)?.filter).toBe("deployable");
  });

  it("formatHeroListFilterChipResidualDeepSweepLine mentions consolidation", () => {
    captureHeroListFilterChipResidualDeep("all", "level_desc", "hero-sort-level", storage);
    const line = formatHeroListFilterChipResidualDeepSweepLine(
      readHeroListFilterChipResidualDeepSession(storage),
    );
    expect(line).toContain("筛选巩固");
    expect(line).toContain("返回高亮不退化");
    expect(line).toContain("等级↓");
  });
});
