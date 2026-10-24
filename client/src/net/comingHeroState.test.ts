import { describe, expect, it } from "vitest";
import { getTypes, Routes } from "@/net/loadProto";
import {
  canConfirmComingAccept,
  filterComingForCity,
  formatComingHeroGatewayError,
  parseListComingHeroesResponse,
  parseTryAcceptComingResponse,
} from "@/net/comingHeroState";

describe("comingHeroState (CLIENT-hero-coming-001)", () => {
  it("round-trips ListComingHeroesRequest", () => {
    const { ListComingHeroesRequest } = getTypes();
    const msg = ListComingHeroesRequest.create({ server_id: 1 });
    const decoded = ListComingHeroesRequest.decode(ListComingHeroesRequest.encode(msg).finish());
    expect(decoded.server_id).toBe(1);
    expect(Routes.ListComingHeroes).toBe("hero.v1.ListComingHeroes");
  });

  it("parses list and filters by city", () => {
    const rows = parseListComingHeroesResponse({
      coming: [
        { hero_id: 10, city_id: 1, display_name: "赵云", level: 12 },
        { hero_id: 11, city_id: 2, display_name: "马超", level: 10 },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(filterComingForCity(rows, 1)).toHaveLength(1);
    expect(filterComingForCity(rows, 1)[0]?.display_name).toBe("赵云");
  });

  it("maps gateway errors to readable hints", () => {
    expect(formatComingHeroGatewayError(new Error("hero: hero is not coming"))).toContain("来投");
    expect(formatComingHeroGatewayError(new Error("hero: hero capacity full (office level)"))).toContain(
      "招贤馆容量已满",
    );
  });

  it("parses try accept preview and gates confirm", () => {
    const preview = parseTryAcceptComingResponse({
      hero_id: 3,
      summary: "是否接受将领关羽加入麾下？",
    });
    expect(preview.summary).toContain("关羽");
    expect(canConfirmComingAccept(preview, 3).ok).toBe(true);
    expect(canConfirmComingAccept(preview, 4).ok).toBe(false);
  });
});
