import { beforeEach, describe, expect, it } from "vitest";
import {
  captureHeroListFilterChipResidualDeepestDeeper,
  formatHeroListFilterChipResidualDeepestDeeperSweepLine,
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SESSION_KEY,
  readHeroListFilterChipResidualDeepestDeeperSession,
} from "@/net/heroListFilterChipResidualDeepestDeeper";
import {
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY,
  readHeroListFilterChipResidualDeepestSession,
} from "@/net/heroListFilterChipResidualDeepest";
import {
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY,
  readHeroListFilterChipResidualDeeperSession,
} from "@/net/heroListFilterChipResidualDeeper";
import {
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY,
  readHeroListFilterChipResidualDeepSession,
} from "@/net/heroListFilterChipResidualDeep";
import { HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY } from "@/net/heroListFilterChipResidual";
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

describe("heroListFilterChipResidualDeepestDeeper (CLIENT-311)", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = mockStorage();
  });

  it("persists hero-list-filter-chip-residual-deepest-deeper-v1 alongside deepest and legacy sessions", () => {
    storage.setItem(HERO_LIST_FILTER_SESSION_KEY, "deployable");
    captureHeroListFilterChipResidualDeepestDeeper(
      "deployable",
      "loyalty_desc",
      "hero-filter-deployable",
      storage,
    );
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY)).toBeTruthy();
    const deepestDeeper = readHeroListFilterChipResidualDeepestDeeperSession(storage);
    expect(deepestDeeper?.filter).toBe("deployable");
    expect(deepestDeeper?.lastChipAction).toBe("hero-filter-deployable");
    expect(readHeroListFilterChipResidualDeepestSession(storage)?.filter).toBe("deployable");
    expect(readHeroListFilterChipResidualDeeperSession(storage)?.filter).toBe("deployable");
    expect(readHeroListFilterChipResidualDeepSession(storage)?.filter).toBe("deployable");
  });

  it("formatHeroListFilterChipResidualDeepestDeeperSweepLine mentions consolidation", () => {
    captureHeroListFilterChipResidualDeepestDeeper("all", "level_desc", "hero-sort-level", storage);
    const line = formatHeroListFilterChipResidualDeepestDeeperSweepLine(
      readHeroListFilterChipResidualDeepestDeeperSession(storage),
    );
    expect(line).toContain("筛选巩固再加深二层");
    expect(line).toContain("hero-list-filter-chip-residual-deepest-v1");
    expect(line).toContain("CLIENT-231");
    expect(line).toContain("等级↓");
  });
});
