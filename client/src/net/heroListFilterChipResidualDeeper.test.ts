import { beforeEach, describe, expect, it } from "vitest";
import {
  captureHeroListFilterChipResidualDeeper,
  formatHeroListFilterChipResidualDeeperSweepLine,
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

describe("heroListFilterChipResidualDeeper (CLIENT-279)", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = mockStorage();
  });

  it("persists hero-list-filter-chip-residual-deeper-v1 alongside deep and v1 sessions", () => {
    storage.setItem(HERO_LIST_FILTER_SESSION_KEY, "deployable");
    captureHeroListFilterChipResidualDeeper(
      "deployable",
      "loyalty_desc",
      "hero-filter-deployable",
      storage,
    );
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY)).toBeTruthy();
    expect(storage.getItem(HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY)).toBeTruthy();
    const deeper = readHeroListFilterChipResidualDeeperSession(storage);
    expect(deeper?.filter).toBe("deployable");
    expect(deeper?.lastChipAction).toBe("hero-filter-deployable");
    expect(readHeroListFilterChipResidualDeepSession(storage)?.filter).toBe("deployable");
  });

  it("formatHeroListFilterChipResidualDeeperSweepLine mentions consolidation", () => {
    captureHeroListFilterChipResidualDeeper("all", "level_desc", "hero-sort-level", storage);
    const line = formatHeroListFilterChipResidualDeeperSweepLine(
      readHeroListFilterChipResidualDeeperSession(storage),
    );
    expect(line).toContain("筛选巩固再加深");
    expect(line).toContain("hero-list-filter-chip-residual-deep-v1");
    expect(line).toContain("CLIENT-231");
    expect(line).toContain("等级↓");
  });
});
