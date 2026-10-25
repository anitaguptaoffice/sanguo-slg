import { beforeEach, describe, expect, it } from "vitest";
import {
  captureHeroListFilterChipResidualDeepestDeepestDeeper,
  formatHeroListFilterChipResidualDeepestDeepestDeeperSweepLine,
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SESSION_KEY,
  readHeroListFilterChipResidualDeepestDeepestDeeperSession,
} from "@/net/heroListFilterChipResidualDeepestDeepestDeeper";
import {
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

describe("heroListFilterChipResidualDeepestDeepestDeeper (CLIENT-327)", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = mockStorage();
  });

  it("persists hero-list-filter-chip-residual-deepest-deepest-deeper-v1 alongside deepest-deeper and legacy sessions", () => {
    storage.setItem(HERO_LIST_FILTER_SESSION_KEY, "deployable");
    captureHeroListFilterChipResidualDeepestDeepestDeeper(
      "deployable",
      "loyalty_desc",
      "hero-filter-deployable",
      storage,
    );
    expect(
      storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SESSION_KEY),
    ).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY)).toBeTruthy();
    const deepestDeepestDeeper = readHeroListFilterChipResidualDeepestDeepestDeeperSession(storage);
    expect(deepestDeepestDeeper?.filter).toBe("deployable");
    expect(deepestDeepestDeeper?.lastChipAction).toBe("hero-filter-deployable");
    expect(readHeroListFilterChipResidualDeepestDeeperSession(storage)?.filter).toBe("deployable");
    expect(readHeroListFilterChipResidualDeepestSession(storage)?.filter).toBe("deployable");
    expect(readHeroListFilterChipResidualDeeperSession(storage)?.filter).toBe("deployable");
    expect(readHeroListFilterChipResidualDeepSession(storage)?.filter).toBe("deployable");
  });

  it("formatHeroListFilterChipResidualDeepestDeepestDeeperSweepLine mentions consolidation", () => {
    captureHeroListFilterChipResidualDeepestDeepestDeeper(
      "all",
      "level_desc",
      "hero-sort-level",
      storage,
    );
    const line = formatHeroListFilterChipResidualDeepestDeepestDeeperSweepLine(
      readHeroListFilterChipResidualDeepestDeepestDeeperSession(storage),
    );
    expect(line).toContain("筛选巩固再加深三层");
    expect(line).toContain("hero-list-filter-chip-residual-deepest-deeper-v1");
    expect(line).toContain("CLIENT-231");
    expect(line).toContain("等级↓");
  });
});
