import { describe, expect, it } from "vitest";
import {
  buildMarchHeroSelectOptions,
  formatHeroStatusLabel,
  HERO_STATUS_IDLE,
  HERO_STATUS_MARCH,
  isHeroSelectableForMarch,
  normalizeMarchHeroGatewayMessage,
  syncMarchHeroSelect,
  validateMarchHeroSelection,
} from "@/net/marchHeroPick";

describe("marchHeroPick", () => {
  const idleHero = { hero_id: 10, template_cfg_id: 1001, level: 5, loyalty: 80, status: HERO_STATUS_IDLE };
  const marchingHero = {
    hero_id: 11,
    template_cfg_id: 1002,
    level: 3,
    loyalty: 70,
    status: HERO_STATUS_MARCH,
  };

  it("formatHeroStatusLabel maps idle and marching", () => {
    expect(formatHeroStatusLabel(HERO_STATUS_IDLE)).toBe("空闲");
    expect(formatHeroStatusLabel(HERO_STATUS_MARCH)).toBe("出征");
    expect(formatHeroStatusLabel(undefined)).toBe("空闲");
  });

  it("isHeroSelectableForMarch respects status and local busy set", () => {
    expect(isHeroSelectableForMarch(idleHero)).toBe(true);
    expect(isHeroSelectableForMarch(marchingHero)).toBe(false);
    expect(isHeroSelectableForMarch({ hero_id: 12 }, new Set([12]))).toBe(false);
    expect(isHeroSelectableForMarch({ hero_id: 12, status: 0 })).toBe(true);
  });

  it("validateMarchHeroSelection requires owned idle hero", () => {
    expect(
      validateMarchHeroSelection({ heroIdRaw: "", ownedHeroes: [idleHero] }).message,
    ).toContain("请选择带队将领");
    expect(
      validateMarchHeroSelection({ heroIdRaw: "10", ownedHeroes: [idleHero] }),
    ).toEqual({ ok: true, heroId: 10 });
    expect(
      validateMarchHeroSelection({ heroIdRaw: "99", ownedHeroes: [idleHero] }).message,
    ).toContain("不属于您");
    expect(
      validateMarchHeroSelection({ heroIdRaw: "11", ownedHeroes: [marchingHero] }).message,
    ).toContain("出征");
  });

  it("buildMarchHeroSelectOptions marks busy heroes disabled", () => {
    const opts = buildMarchHeroSelectOptions([idleHero, marchingHero]);
    expect(opts.find((o) => o.heroId === 10)?.selectable).toBe(true);
    expect(opts.find((o) => o.heroId === 11)?.selectable).toBe(false);
  });

  it("syncMarchHeroSelect preselects first idle hero", () => {
    const root = document.createElement("div");
    root.innerHTML = `<select data-field="march-hero"></select>`;
    syncMarchHeroSelect(root, [idleHero, marchingHero]);
    const select = root.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("10");
    expect(select.options.length).toBe(3);
  });

  it("normalizeMarchHeroGatewayMessage maps server hero errors", () => {
    expect(normalizeMarchHeroGatewayMessage("hero_id required")).toBe("请选择带队将领");
    expect(normalizeMarchHeroGatewayMessage("hero: hero not found")).toBe("将领不存在或不属于您");
    expect(normalizeMarchHeroGatewayMessage("hero: insufficient march force")).toBe(
      "将领出征体力不足",
    );
    expect(normalizeMarchHeroGatewayMessage("hero: hero is not idle")).toBe(
      "将领当前非空闲，无法出征",
    );
  });
});
