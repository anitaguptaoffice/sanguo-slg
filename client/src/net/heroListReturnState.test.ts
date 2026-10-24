import { describe, expect, it } from "vitest";
import {
  formatHeroDetailFromListHint,
  HERO_LIST_RETURN_SESSION_KEY,
  parseHeroListReturnState,
  readHeroListReturnState,
  serializeHeroListReturnState,
  writeHeroListReturnState,
} from "@/net/heroListReturnState";

describe("heroListReturnState", () => {
  it("serializeHeroListReturnState round-trips filter sort scroll and heroId", () => {
    const raw = serializeHeroListReturnState({
      filter: "deployable",
      sort: "loyalty_desc",
      scrollTop: 88,
      heroId: 12,
    });
    expect(parseHeroListReturnState(raw)).toEqual({
      filter: "deployable",
      sort: "loyalty_desc",
      scrollTop: 88,
      heroId: 12,
    });
  });

  it("rejects invalid hero id or negative scroll", () => {
    expect(
      parseHeroListReturnState(
        serializeHeroListReturnState({
          filter: "all",
          sort: "level_desc",
          scrollTop: -1,
          heroId: 1,
        }),
      ),
    ).toBeNull();
    expect(parseHeroListReturnState('{"filter":"all","sort":"level_desc","heroId":0,"scrollTop":0}')).toBeNull();
  });

  it("formatHeroDetailFromListHint summarizes filter and sort", () => {
    expect(
      formatHeroDetailFromListHint({ filter: "deployable", sort: "loyalty_desc" }),
    ).toBe("来自列表：可出征 · 忠诚↓");
    expect(formatHeroDetailFromListHint(null)).toBe("");
  });

  it("persists under hero-list-return-v1", () => {
    const mock = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mock.get(k) ?? null,
      setItem: (k: string, v: string) => mock.set(k, v),
      removeItem: (k: string) => mock.delete(k),
    };
    writeHeroListReturnState(
      { filter: "all", sort: "level_desc", scrollTop: 40, heroId: 5 },
      storage,
    );
    expect(mock.get(HERO_LIST_RETURN_SESSION_KEY)).toBeTruthy();
    expect(readHeroListReturnState(storage)?.heroId).toBe(5);
  });
});
