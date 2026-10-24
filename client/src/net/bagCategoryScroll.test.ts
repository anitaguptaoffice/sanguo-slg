import { describe, expect, it } from "vitest";
import { BAG_CATEGORY_TAB_SESSION_KEY } from "@/net/bagCategory";
import {
  parseBagCategoryScrollState,
  readBagCategoryScrollState,
  serializeBagCategoryScrollState,
  updateBagCategoryScrollTop,
  updateBagCategoryTabInScrollState,
  writeBagCategoryScrollState,
} from "@/net/bagCategoryScroll";

describe("bagCategoryScroll (CLIENT-210)", () => {
  it("serializeBagCategoryScrollState round-trips tab and per-category scrollTop", () => {
    const raw = serializeBagCategoryScrollState({
      tab: "consumable",
      scrollTops: { all: 10, consumable: 88, cultivation: 0 },
    });
    expect(parseBagCategoryScrollState(raw)).toEqual({
      tab: "consumable",
      scrollTops: { all: 10, consumable: 88, cultivation: 0 },
    });
  });

  it("parseBagCategoryScrollState accepts legacy plain tab string", () => {
    expect(parseBagCategoryScrollState("cultivation")).toEqual({
      tab: "cultivation",
      scrollTops: {},
    });
  });

  it("persists merged state under bag-category-tab-v1", () => {
    const storage = new Map<string, string>();
    const mock = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storage.set(k, v);
      },
    };
    updateBagCategoryTabInScrollState("cultivation", mock);
    updateBagCategoryScrollTop("all", 42, mock);
    updateBagCategoryScrollTop("cultivation", 120, mock);
    expect(storage.get(BAG_CATEGORY_TAB_SESSION_KEY)).toContain('"tab":"cultivation"');
    const state = readBagCategoryScrollState(mock);
    expect(state.tab).toBe("cultivation");
    expect(state.scrollTops.all).toBe(42);
    expect(state.scrollTops.cultivation).toBe(120);
    writeBagCategoryScrollState({ tab: "all", scrollTops: { consumable: 5 } }, mock);
    expect(parseBagCategoryScrollState(storage.get(BAG_CATEGORY_TAB_SESSION_KEY))).toEqual({
      tab: "all",
      scrollTops: { all: 0, consumable: 5, cultivation: 0 },
    });
  });
});
