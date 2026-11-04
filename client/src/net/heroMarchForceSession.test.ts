import { describe, expect, it } from "vitest";
import {
  HERO_MARCH_FORCE_SESSION_KEY,
  readHeroMarchForceSession,
  heroMarchForceSessionRevision,
  clearHeroMarchForceSession,
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

it("revisions distinguish every write/clear, isolate heroes and storage, and tolerate no storage",()=>{
 const a={getItem:()=>null,setItem:()=>{}},b={getItem:()=>null,setItem:()=>{}};
 expect(heroMarchForceSessionRevision(7,a)).toBe(0);writeHeroMarchForceSession(7,5,24,a);writeHeroMarchForceSession(7,5,24,a);expect(heroMarchForceSessionRevision(7,a)).toBe(2);expect(heroMarchForceSessionRevision(8,a)).toBe(0);expect(heroMarchForceSessionRevision(7,b)).toBe(0);
 clearHeroMarchForceSession(7,a);clearHeroMarchForceSession(7,a);expect(heroMarchForceSessionRevision(7,a)).toBe(4);expect(heroMarchForceSessionRevision(7,null)).toBe(0);
});
