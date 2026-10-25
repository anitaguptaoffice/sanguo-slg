import { beforeEach, describe, expect, it } from "vitest";
import {
  captureHeroListFilterChipResidualDeepestDeepestDeepestDeepest,
  formatHeroListFilterChipResidualDeepestDeepestDeepestDeepestSweepLine,
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY,
  readHeroListFilterChipResidualDeepestDeepestDeepestDeepestSession,
} from "@/net/heroListFilterChipResidualDeepestDeepestDeepestDeepest";
import {
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY,
  readHeroListFilterChipResidualDeepestDeepestDeepestSession,
} from "@/net/heroListFilterChipResidualDeepestDeepestDeepest";
import { HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SESSION_KEY } from "@/net/heroListFilterChipResidualDeepestDeepestDeepestDeeper";

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

describe("heroListFilterChipResidualDeepestDeepestDeepestDeepest (CLIENT-375)", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = mockStorage();
  });

  it("persists hero-list-filter-chip-residual-deepest-deepest-deepest-deepest-v1 alongside deepest-deepest-deepest session", () => {
    captureHeroListFilterChipResidualDeepestDeepestDeepestDeepest(
      "deployable",
      "loyalty_desc",
      "hero-filter-deployable",
      storage,
    );
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY)).toBeTruthy();
    const deepestDeepestDeepestDeepest = readHeroListFilterChipResidualDeepestDeepestDeepestDeepestSession(storage);
    expect(deepestDeepestDeepestDeepest?.filter).toBe("deployable");
    expect(deepestDeepestDeepestDeepest?.lastChipAction).toBe("hero-filter-deployable");
    const line = formatHeroListFilterChipResidualDeepestDeepestDeepestDeepestSweepLine(deepestDeepestDeepestDeepest);
    expect(line).toContain("筛选巩固再加深五层");
    expect(line).toContain("hero-list-filter-chip-residual-deepest-deepest-deepest-v1");
  });

  it("captureHeroListFilterChipResidualDeepestDeepestDeepestDeeper also writes deepest-deepest-deepest-deepest session", async () => {
    const { captureHeroListFilterChipResidualDeepestDeepestDeepestDeeper } = await import(
      "@/net/heroListFilterChipResidualDeepestDeepestDeepestDeeper"
    );
    captureHeroListFilterChipResidualDeepestDeepestDeepestDeeper(
      "all",
      "level_desc",
      "hero-filter-all",
      storage,
    );
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SESSION_KEY)).toBeTruthy();
  });
});
