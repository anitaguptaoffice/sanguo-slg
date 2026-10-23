import { describe, expect, it } from "vitest";
import {
  battleReportListLines,
  battleReportMatchesOutcomeFilter,
  filterBattleReportsByOutcome,
  formatBattleReportDetail,
  formatCasualtyMap,
  formatMarchHint,
  formatMarchLine,
  formatMarchRemainingMs,
  formatMarchRemainingMsAbbrev,
  formatMarchRowMetaLine,
  formatMarchRowPrimaryLine,
  formatReportLine,
  marchListLines,
  marchNeedsPoll,
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
    expect(
      formatMarchLine({
        march_id: 2,
        purpose: 1,
        phase: 2,
        from_x: 0,
        from_y: 0,
        to_x: 5,
        to_y: 5,
        depart_at_ms: Date.UTC(2024, 0, 1, 8, 0, 0),
        arrive_at_ms: Date.UTC(2024, 0, 1, 9, 0, 0),
      }),
    ).toContain("攻击");
    expect(marchListLines([])[0]).toContain("暂无行军");
    expect(marchNeedsPoll([{ phase: 3 }])).toBe(false);
    expect(marchNeedsPoll([{ phase: 2 }])).toBe(true);
  });

  it("formats march remaining ETA and two-line row helpers", () => {
    const now = Date.UTC(2024, 0, 1, 8, 30, 0);
    const arriveFar = Date.UTC(2024, 0, 1, 9, 0, 0);
    expect(formatMarchRemainingMs(now, arriveFar)).toBe("剩余 30m");
    expect(formatMarchRemainingMs(now, now + 30_000)).toBe("即将到达");
    expect(formatMarchRemainingMs(now, now)).toBe("即将到达");
    expect(formatMarchRemainingMsAbbrev(now, arriveFar)).toBe("30");
    expect(formatMarchRemainingMsAbbrev(now, now + 30_000)).toBe("即将");

    const marching = {
      march_id: 2,
      purpose: 1,
      phase: 2,
      from_x: 0,
      from_y: 0,
      to_x: 5,
      to_y: 5,
      depart_at_ms: Date.UTC(2024, 0, 1, 8, 0, 0),
      arrive_at_ms: arriveFar,
    };
    expect(formatMarchRowPrimaryLine(marching)).toContain("#2 · 攻击 · 行军中");
    expect(formatMarchRowMetaLine(marching, now)).toContain("剩余 30m");

    const arrived = { ...marching, phase: 3 };
    expect(formatMarchRowMetaLine(arrived, now)).toContain("已到达");
    expect(formatMarchRowMetaLine(arrived, now)).not.toContain("剩余");

    const pending = { ...marching, phase: 1 };
    expect(formatMarchRowMetaLine(pending, now)).toContain("待发");
  });

  it("filters battle reports by outcome client-side", () => {
    const reports = [
      { report_id: 1, outcome: 1 },
      { report_id: 2, outcome: 2 },
      { report_id: 3, outcome: 3 },
      { report_id: 4, outcome: 1 },
    ];
    expect(filterBattleReportsByOutcome(reports, "all")).toHaveLength(4);
    expect(filterBattleReportsByOutcome(reports, "win").map((r) => r.report_id)).toEqual([1, 4]);
    expect(filterBattleReportsByOutcome(reports, "loss").map((r) => r.report_id)).toEqual([2]);
    expect(filterBattleReportsByOutcome(reports, "draw").map((r) => r.report_id)).toEqual([3]);
    expect(battleReportMatchesOutcomeFilter({ outcome: 2 }, "loss")).toBe(true);
    expect(battleReportMatchesOutcomeFilter({ outcome: 2 }, "win")).toBe(false);
  });

  it("formats battle report detail summary", () => {
    const text = formatBattleReportDetail(9, { report_id: 9, outcome: 1 }, {
      result: "attacker_win",
      rounds: [{ round: 1 }, { round: 2 }],
      attacker_casualties: { infantry: 10 },
      defender_casualties: { cavalry: 5 },
    });
    expect(text).toContain("攻方获胜");
    expect(text).toContain("回合数：2");
    expect(text).toContain("步兵 10");
    expect(text).toContain("骑兵 5");
    expect(formatCasualtyMap({})).toBe("无");
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
  it("round-trips ListMarchesRequest", () => {
    const { ListMarchesRequest } = getTypes();
    const msg = ListMarchesRequest.create({ city_id: 501, limit: 20, offset: 0 });
    const decoded = ListMarchesRequest.decode(ListMarchesRequest.encode(msg).finish());
    expect(Number(decoded.city_id)).toBe(501);
    expect(decoded.limit).toBe(20);
  });

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
