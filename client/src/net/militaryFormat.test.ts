import { describe, expect, it } from "vitest";
import {
  battleReportListLines,
  formatMarchHint,
  formatReportLine,
  pickMarchTroops,
  unitLabel,
} from "@/net/militaryFormat";
import { getTypes } from "@/net/loadProto";

describe("militaryFormat", () => {
  it("labels units and march hints", () => {
    expect(unitLabel(1)).toBe("步兵");
    expect(
      formatMarchHint({
        march_id: 9,
        to_x: 5,
        to_y: 5,
        phase: 2,
        arrive_at_ms: Date.UTC(2024, 0, 1, 12, 0, 0),
      }),
    ).toContain("行军中");
    expect(
      formatReportLine({
        report_id: 3,
        location_x: 5,
        location_y: 5,
        outcome: 1,
        created_at_ms: Date.UTC(2024, 0, 2, 8, 0, 0),
      }),
    ).toContain("攻胜");
    expect(
      formatReportLine({
        report_id: 1,
        location_x: 3,
        location_y: 4,
        outcome: 1,
        created_at_ms: 0,
      }),
    ).toContain("坐标(3,4)");
    expect(battleReportListLines([])[0]).toContain("暂无战报");
  });

  it("pickMarchTroops caps by available count", () => {
    const troops = pickMarchTroops(
      [{ unit_cfg_id: 1, count: 30 }],
      1,
      100,
    );
    expect(troops).toEqual([{ unit_cfg_id: 1, count: 30 }]);
    expect(pickMarchTroops([], 1, 10)).toEqual([]);
  });
});

describe("military proto encode/decode", () => {
  it("round-trips StartMarchRequest", () => {
    const { StartMarchRequest } = getTypes();
    const msg = StartMarchRequest.create({
      city_id: 42,
      to_x: 5,
      to_y: 5,
      purpose: 1,
      troops: [{ unit_cfg_id: 1, count: 50 }],
    });
    const decoded = StartMarchRequest.decode(StartMarchRequest.encode(msg).finish());
    expect(Number(decoded.city_id)).toBe(42);
    expect(decoded.to_x).toBe(5);
    expect(decoded.troops?.[0]?.count).toBe(50);
  });
});
