import { describe, expect, it } from "vitest";
import {
  canAffordHotelCandidate,
  formatHotelRecruitGatewayError,
  parseHotelRecruitListResponse,
} from "@/net/hotelRecruitState";

describe("hotelRecruitState", () => {
  it("maps capacity and gate errors to readable Chinese", () => {
    const cap = Object.assign(new Error("hero: hero capacity full (office level)"), { code: 10001 });
    expect(formatHotelRecruitGatewayError(cap)).toContain("招贤馆容量已满");
    expect(formatHotelRecruitGatewayError(cap)).toContain("[10001]");
    const hotel = Object.assign(new Error("hero: hotel not built"), { code: 10001 });
    expect(formatHotelRecruitGatewayError(hotel)).toContain("尚未建造客栈");
  });

  it("parses list response and blocks recruit when at capacity", () => {
    const { candidates, meta } = parseHotelRecruitListResponse({
      candidates: [
        {
          candidate_id: 7,
          display_name: "赵武",
          level: 3,
          gold_cost: 500,
          attributes: { force: 40, intel: 30, politics: 20, command: 25 },
        },
      ],
      hotel_level: 2,
      hero_capacity: 3,
      hero_owned: 3,
    });
    expect(candidates[0].display_name).toBe("赵武");
    expect(meta.hotel_level).toBe(2);
    const pick = canAffordHotelCandidate(candidates[0], { gold: 10_000 }, meta);
    expect(pick.ok).toBe(false);
    expect(pick.reason).toContain("招贤馆容量已满");
  });

  it("blocks recruit when gold insufficient", () => {
    const c = { candidate_id: 1, display_name: "测试", gold_cost: 1000 };
    const pick = canAffordHotelCandidate(c, { gold: 50 }, { hero_capacity: 10, hero_owned: 1 });
    expect(pick.ok).toBe(false);
    expect(pick.reason).toContain("金币不足");
  });
});
