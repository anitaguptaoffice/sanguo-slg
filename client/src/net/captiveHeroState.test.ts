import { describe, expect, it } from "vitest";
import { getTypes, Routes } from "@/net/loadProto";
import {
  canAffordCaptiveSummon,
  filterCaptivesForCity,
  formatCaptiveHeroGatewayError,
  parseListCaptiveHeroesResponse,
  parseTrySummonCaptiveResponse,
} from "@/net/captiveHeroState";

describe("captiveHeroState (CLIENT-hero-captive-001)", () => {
  it("round-trips ListCaptiveHeroesRequest", () => {
    const { ListCaptiveHeroesRequest } = getTypes();
    const msg = ListCaptiveHeroesRequest.create({ server_id: 1 });
    const decoded = ListCaptiveHeroesRequest.decode(ListCaptiveHeroesRequest.encode(msg).finish());
    expect(decoded.server_id).toBe(1);
    expect(Routes.ListCaptiveHeroes).toBe("hero.v1.ListCaptiveHeroes");
  });

  it("parses list and filters by city", () => {
    const rows = parseListCaptiveHeroesResponse({
      captives: [
        { hero_id: 7, city_id: 1, display_name: "关羽", level: 5, loyalty: 40 },
        { hero_id: 8, city_id: 2, display_name: "张飞", level: 4 },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(filterCaptivesForCity(rows, 1)).toHaveLength(1);
    expect(filterCaptivesForCity(rows, 1)[0]?.display_name).toBe("关羽");
  });

  it("maps gateway errors to readable Chinese", () => {
    const err = new Error("hero: hero is not captive");
    (err as Error & { code: number }).code = 10001;
    expect(formatCaptiveHeroGatewayError(err)).toContain("已不是俘虏");
    expect(formatCaptiveHeroGatewayError(new Error("hero: insufficient gold"))).toContain("金币不足");
  });

  it("canAffordCaptiveSummon checks gold and items", () => {
    const preview = parseTrySummonCaptiveResponse({
      hero_id: 3,
      gold_cost: 500,
      items: [{ item_cfg_id: 2050, quantity: 2 }],
      summary: "",
    });
    expect(canAffordCaptiveSummon(preview, { gold: 100 }, []).ok).toBe(false);
    expect(
      canAffordCaptiveSummon(preview, { gold: 1000 }, [{ item_cfg_id: 2050, quantity: 2 }]).ok,
    ).toBe(true);
  });
});
