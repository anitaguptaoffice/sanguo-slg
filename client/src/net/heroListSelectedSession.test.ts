import { describe, expect, it } from "vitest";
import {
  HERO_LIST_SELECTED_SESSION_KEY,
  applyHeroPanelListScrollTop,
  parseHeroListSelectedSession,
  readHeroListSelectedSession,
  readHeroPanelListScrollTop,
  writeHeroListSelectedSession,
} from "@/net/heroListSelectedSession";

describe("heroListSelectedSession", () => {
  it("round-trips heroId and scrollTop", () => {
    const storage = new Map<string, string>();
    const mock = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
    };
    writeHeroListSelectedSession({ heroId: 12, scrollTop: 240 }, mock);
    expect(readHeroListSelectedSession(mock)).toEqual({ heroId: 12, scrollTop: 240 });
    expect(storage.get(HERO_LIST_SELECTED_SESSION_KEY)).toContain("240");
  });

  it("parse rejects invalid payload", () => {
    expect(parseHeroListSelectedSession("")).toBeNull();
    expect(parseHeroListSelectedSession('{"heroId":0,"scrollTop":1}')).toBeNull();
    expect(parseHeroListSelectedSession('{"heroId":2,"scrollTop":-1}')).toBeNull();
  });
});

describe("hero panel scroll helpers", () => {
  it("reads and applies scrollTop on hero-scroll", () => {
    const panel = document.createElement("div");
    panel.innerHTML = `
      <div class="panel-scroll-body" data-role="hero-scroll" style="height:80px;overflow:auto">
        <div style="height:400px"></div>
      </div>
    `;
    const scroll = panel.querySelector('[data-role="hero-scroll"]') as HTMLElement;
    scroll.scrollTop = 156;
    expect(readHeroPanelListScrollTop(panel)).toBe(156);
    applyHeroPanelListScrollTop(panel, 88);
    expect(scroll.scrollTop).toBe(88);
  });
});
