import { describe, expect, it } from "vitest";
import {
  HERO_MARCH_FORCE_SESSION_KEY,
  readHeroMarchForceSession,
  writeHeroMarchForceSession,
} from "@/net/heroMarchForceSession";

describe("heroMarchForceSession", () => {
  it("round-trips per hero_id", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
    };
    writeHeroMarchForceSession(7, 12, 40, storage);
    const entry = readHeroMarchForceSession(7, storage);
    expect(entry?.current).toBe(12);
    expect(entry?.max).toBe(40);
    expect(map.get(HERO_MARCH_FORCE_SESSION_KEY)).toContain('"7"');
  });
});
