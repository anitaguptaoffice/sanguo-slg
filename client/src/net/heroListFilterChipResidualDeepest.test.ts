import { beforeEach, describe, expect, it } from "vitest";
import {
  captureHeroListFilterChipResidualDeepest,
  formatHeroListFilterChipResidualDeepestSweepLine,
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

describe("heroListFilterChipResidualDeepest (CLIENT-295)", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = mockStorage();
  });

  it("persists hero-list-filter-chip-residual-deepest-v1 alongside deeper deep and v1 sessions", () => {
    storage.setItem(HERO_LIST_FILTER_SESSION_KEY, "deployable");
    captureHeroListFilterChipResidualDeepest(
      "deployable",
      "loyalty_desc",
      "hero-filter-deployable",
      storage,
    );
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY)).toBeTruthy();
    const deepest = readHeroListFilterChipResidualDeepestSession(storage);
    expect(deepest?.filter).toBe("deployable");
    expect(deepest?.lastChipAction).toBe("hero-filter-deployable");
    expect(readHeroListFilterChipResidualDeeperSession(storage)?.filter).toBe("deployable");
    expect(readHeroListFilterChipResidualDeepSession(storage)?.filter).toBe("deployable");
  });

  it("formatHeroListFilterChipResidualDeepestSweepLine mentions consolidation", () => {
    captureHeroListFilterChipResidualDeepest("all", "level_desc", "hero-sort-level", storage);
    const line = formatHeroListFilterChipResidualDeepestSweepLine(
      readHeroListFilterChipResidualDeepestSession(storage),
    );
    expect(line).toContain("筛选巩固再加深一层");
    expect(line).toContain("hero-list-filter-chip-residual-deeper-v1");
    expect(line).toContain("CLIENT-231");
    expect(line).toContain("等级↓");
  });
});
