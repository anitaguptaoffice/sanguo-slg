import { describe, expect, it } from "vitest";
import {
  HERO_DETAIL_SELECTED_SESSION_KEY,
  parseHeroDetailSelectedSessionValue,
  pickRestoredHeroId,
  readHeroDetailSelectedSession,
  writeHeroDetailSelectedSession,
} from "@/net/heroDetailSelectedSession";

describe("heroDetailSelectedSession", () => {
  it("parses positive hero ids only", () => {
    expect(parseHeroDetailSelectedSessionValue(null)).toBeNull();
    expect(parseHeroDetailSelectedSessionValue("")).toBeNull();
    expect(parseHeroDetailSelectedSessionValue("0")).toBeNull();
    expect(parseHeroDetailSelectedSessionValue("abc")).toBeNull();
    expect(parseHeroDetailSelectedSessionValue("42")).toBe(42);
    expect(parseHeroDetailSelectedSessionValue("  7  ")).toBe(7);
  });

  it("round-trips via sessionStorage key hero-detail-selected-id", () => {
    const storage = new Map<string, string>();
    const shim = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => {
        storage.set(k, v);
      },
    };
    writeHeroDetailSelectedSession(99, shim);
    expect(storage.get(HERO_DETAIL_SELECTED_SESSION_KEY)).toBe("99");
    expect(readHeroDetailSelectedSession(shim)).toBe(99);
    writeHeroDetailSelectedSession(-1, shim);
    expect(readHeroDetailSelectedSession(shim)).toBe(99);
  });

  it("pickRestoredHeroId requires roster membership", () => {
    const heroes = [{ hero_id: 3 }, { hero_id: 5 }];
    expect(pickRestoredHeroId(heroes, 5)).toBe(5);
    expect(pickRestoredHeroId(heroes, 9)).toBeNull();
    expect(pickRestoredHeroId(heroes, null)).toBeNull();
  });
});
