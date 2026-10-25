import { beforeEach, describe, expect, it } from "vitest";
import {
  captureHeroListFilterChipResidualDeepestDeepestDeepestDeeper,
  formatHeroListFilterChipResidualDeepestDeepestDeepestDeeperSweepLine,
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SESSION_KEY,
  readHeroListFilterChipResidualDeepestDeepestDeepestDeeperSession,
} from "@/net/heroListFilterChipResidualDeepestDeepestDeepestDeeper";
import {
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY,
  readHeroListFilterChipResidualDeepestDeepestDeepestSession,
} from "@/net/heroListFilterChipResidualDeepestDeepestDeepest";
import {
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
import {
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY,
  readHeroListFilterChipResidualDeepestDeepestDeepestDeepestSession,
} from "@/net/heroListFilterChipResidualDeepestDeepestDeepestDeepest";

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

describe("heroListFilterChipResidualDeepestDeepestDeepestDeeper (CLIENT-375)", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = mockStorage();
  });

  it("persists hero-list-filter-chip-residual-deepest-deepest-deepest-deeper-v1 alongside deepest-deepest-deepest and legacy sessions", () => {
    storage.setItem(HERO_LIST_FILTER_SESSION_KEY, "deployable");
    captureHeroListFilterChipResidualDeepestDeepestDeepestDeeper(
      "deployable",
      "loyalty_desc",
      "hero-filter-deployable",
      storage,
    );
    expect(
      storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SESSION_KEY),
    ).toBeTruthy();
    expect(
      storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY),
    ).toBeTruthy();
    expect(
      storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY),
    ).toBeTruthy();
    expect(
      storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SESSION_KEY),
    ).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY)).toBeTruthy();
    const deepestDeepestDeepestDeeper = readHeroListFilterChipResidualDeepestDeepestDeepestDeeperSession(
      storage,
    );
    expect(deepestDeepestDeepestDeeper?.filter).toBe("deployable");
    expect(deepestDeepestDeepestDeeper?.lastChipAction).toBe("hero-filter-deployable");
    expect(readHeroListFilterChipResidualDeepestDeepestDeepestDeepestSession(storage)?.filter).toBe(
      "deployable",
    );
    expect(readHeroListFilterChipResidualDeepestDeepestDeepestSession(storage)?.filter).toBe(
      "deployable",
    );
    expect(readHeroListFilterChipResidualDeepestDeepestDeeperSession(storage)?.filter).toBe(
      "deployable",
    );
    expect(readHeroListFilterChipResidualDeepestDeeperSession(storage)?.filter).toBe("deployable");
    expect(readHeroListFilterChipResidualDeepestSession(storage)?.filter).toBe("deployable");
    expect(readHeroListFilterChipResidualDeeperSession(storage)?.filter).toBe("deployable");
    expect(readHeroListFilterChipResidualDeepSession(storage)?.filter).toBe("deployable");
  });

  it("formatHeroListFilterChipResidualDeepestDeepestDeepestDeeperSweepLine mentions consolidation", () => {
    captureHeroListFilterChipResidualDeepestDeepestDeepestDeeper(
      "all",
      "level_desc",
      "hero-sort-level",
      storage,
    );
    const line = formatHeroListFilterChipResidualDeepestDeepestDeepestDeeperSweepLine(
      readHeroListFilterChipResidualDeepestDeepestDeepestDeeperSession(storage),
    );
    expect(line).toContain("筛选巩固再加深五层");
    expect(line).toContain("hero-list-filter-chip-residual-deepest-deepest-deepest-deepest-v1");
    expect(line).toContain("CLIENT-231");
    expect(line).toContain("等级↓");
  });
});
