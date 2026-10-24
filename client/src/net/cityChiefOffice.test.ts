import { describe, expect, it, vi } from "vitest";
import { getTypes, Routes } from "@/net/loadProto";
import {
  CITY_CHIEF_MARCH_BLOCK_MESSAGE,
  cityChiefAppointButtonDisabled,
  formatCityChiefCurrentLine,
  formatCityChiefGatewayError,
  formatCityChiefProductionBonusStub,
  heroIdsOnActiveMarch,
  parseCityChiefView,
} from "@/net/cityChiefOffice";
import { loadCityOfficeBundle, runSetCityChief } from "@/net/cityChiefOffice";

describe("cityChiefOffice (CLIENT-hero-office-001)", () => {
  it("collects hero ids from non-stationed marches", () => {
    const ids = heroIdsOnActiveMarch([
      { march_id: 1, phase: 2, hero_id: 9 },
      { march_id: 2, phase: 3, hero_id: 8 },
      { march_id: 3, phase: 4, leader_hero_id: 7 },
    ]);
    expect([...ids].sort()).toEqual([7, 9]);
  });

  it("formats current chief and vacant state", () => {
    expect(formatCityChiefCurrentLine({ hero_id: 0 }, [])).toContain("空缺");
    expect(
      formatCityChiefCurrentLine(
        { hero_id: 11, loyalty: 80 },
        [{ hero_id: 11, template_cfg_id: 1002, level: 5, loyalty: 80 }],
      ),
    ).toContain("关羽");
  });

  it("maps marching hero server error to readable Chinese", () => {
    const err = Object.assign(new Error("hero: hero not available for office"), { code: 10001 });
    expect(formatCityChiefGatewayError(err)).toBe(`${CITY_CHIEF_MARCH_BLOCK_MESSAGE} [10001]`);
  });

  it("blocks appoint when hero is on march (client pre-check)", () => {
    const marching = new Set([42]);
    expect(cityChiefAppointButtonDisabled("idle", 42, marching)).toBe(true);
    expect(cityChiefAppointButtonDisabled("idle", 43, marching)).toBe(false);
  });

  it("production bonus stub tolerates missing bonus", () => {
    expect(formatCityChiefProductionBonusStub(null)).toContain("占位");
    expect(formatCityChiefProductionBonusStub({ production_bonus: 0.05 })).toContain("+5%");
  });

  it("round-trips GetCityChiefRequest", () => {
    const { GetCityChiefRequest } = getTypes();
    const msg = GetCityChiefRequest.create({ server_id: 1, city_id: 9001 });
    const decoded = GetCityChiefRequest.decode(GetCityChiefRequest.encode(msg).finish());
    expect(Number(decoded.city_id)).toBe(9001);
    expect(Routes.GetCityChief).toBe("hero.v1.GetCityChief");
  });

  it("parseCityChiefView normalizes response", () => {
    expect(parseCityChiefView({ hero_id: 3, loyalty: 70, production_bonus: 0.1 }).hero_id).toBe(3);
  });

  it("loadCityOfficeBundle merges gateway responses", async () => {
    const gateway = {
      getCityChief: vi.fn().mockResolvedValue({ hero_id: 2 }),
      listPlayerHeroes: vi.fn().mockResolvedValue({ heroes: [{ hero_id: 2, template_cfg_id: 1001 }] }),
    };
    const bundle = await loadCityOfficeBundle(gateway as never, 1, 9, []);
    expect(bundle.chief.hero_id).toBe(2);
    expect(bundle.heroes).toHaveLength(1);
  });

  it("runSetCityChief maps busy hero to Chinese error", async () => {
    const gateway = {
      setCityChief: vi.fn().mockRejectedValue(
        Object.assign(new Error("hero: hero not available for office"), { code: 10001 }),
      ),
    };
    const out = await runSetCityChief(gateway as never, 1, 1, 4);
    expect(out.error).toContain("出征");
  });
});
