import { describe, expect, it } from "vitest";
import {
  battleReportListLines,
  battleReportMatchesOutcomeFilter,
  battleReportMatchesTimeWindowFilter,
  countBattleReportsByOutcome,
  filterBattleReportsByLocation,
  filterBattleReportsByOutcome,
  filterBattleReportsByTimeWindow,
  findMostRecentBattleReportAtGrid,
  formatBattleReportDetail,
  formatBattleReportCoordinateTag,
  formatBattleReportListPrimaryLine,
  formatBattleReportListStreakLine,
  formatBattleReportOutcomeHeadline,
  formatBattleReportRoundSummaryStrip,
  formatBattleReportRowSummary,
  formatBattleReportRowSummarySansCoord,
  formatCasualtyMap,
  formatMarchHint,
  formatMarchLine,
  formatMarchRemainingMs,
  formatMarchRemainingMsAbbrev,
  formatMarchListPrimaryLine,
  formatMarchListSecondary,
  formatMarchRowMetaLine,
  formatMarchRowPrimaryLine,
  formatMarchRowRecentEtaBrief,
  formatReportLine,
  marchListLines,
  marchNeedsPoll,
  pickMarchTroops,
  marchPhaseChipLabel,
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
    expect(formatMarchRowPrimaryLine(marching)).toContain("#2 · 攻击 ·");
    expect(formatMarchRowPrimaryLine(marching)).not.toContain("行军中");
    expect(marchPhaseChipLabel(2)).toBe("去程");
    expect(marchPhaseChipLabel(3)).toBe("驻扎");
    expect(marchPhaseChipLabel(4)).toBe("返回");
    expect(formatMarchRowMetaLine(marching, now)).toContain("剩余 30m");

    const arrived = { ...marching, phase: 3 };
    expect(formatMarchRowMetaLine(arrived, now)).toContain("已到达");
    expect(formatMarchRowMetaLine(arrived, now)).not.toContain("剩余");

    const pending = { ...marching, phase: 1 };
    expect(formatMarchRowMetaLine(pending, now)).toContain("待发");
    expect(formatMarchRowRecentEtaBrief(marching, now)).toBe("ETA 剩余 30m");
    expect(formatMarchRowRecentEtaBrief(pending, now)).toBe("ETA 待发");

    expect(formatMarchListPrimaryLine(marching)).toContain("(5,5)");
    expect(formatMarchListPrimaryLine(marching)).toContain("攻击");
    expect(formatMarchListPrimaryLine(marching)).toContain("#2");
    expect(formatMarchListSecondary(marching, now)).toBe("剩余 30m · 行军中");
    expect(formatMarchListSecondary(arrived, now)).toBe("已到达");
    expect(formatMarchListSecondary(pending, now)).toBe("待发");
  });

  it("formatBattleReportListStreakLine appends streak on streak head only (CLIENT-207)", () => {
    const reports = [
      { report_id: 3, outcome: 1, defender_player_id: 1, location_x: 1, location_y: 2 },
      { report_id: 2, outcome: 1, defender_player_id: 1, location_x: 1, location_y: 2 },
      { report_id: 1, outcome: 2, defender_player_id: 1, location_x: 1, location_y: 2 },
    ];
    expect(formatBattleReportListStreakLine(reports[0], 0, reports)).toContain("连胜 2");
    expect(formatBattleReportListStreakLine(reports[1], 1, reports)).not.toContain("连胜");
    expect(formatBattleReportListStreakLine(reports[2], 2, reports)).not.toContain("连负");
    expect(
      formatBattleReportListStreakLine(
        { report_id: 9, outcome: 3, defender_player_id: 1, location_x: 0, location_y: 0 },
        0,
        [{ report_id: 9, outcome: 3 }],
      ),
    ).not.toContain("连胜");
  });

  it("formatBattleReportCoordinateTag matches formatReportCoord (CLIENT-223)", () => {
    expect(
      formatBattleReportCoordinateTag({ location_x: 8, location_y: 9 }),
    ).toBe("坐标(8,9)");
    expect(formatBattleReportRowSummarySansCoord({ outcome: 1 })).toBe("攻胜 · 攻:攻方 vs 守:守方");
  });

  it("formatBattleReportRowSummary lists outcome, sides, and coord (CLIENT-176)", () => {
    const report = {
      report_id: 7,
      attacker_player_id: 10001,
      defender_player_id: 10002,
      attacker_display_name: "演示君主",
      location_x: 8,
      location_y: 9,
      outcome: 1,
      created_at_ms: Date.UTC(2024, 5, 1, 10, 0, 0),
    };
    expect(formatBattleReportListPrimaryLine(report)).toContain("#7");
    expect(formatBattleReportListPrimaryLine(report)).toContain("守方玩家#10002");
    expect(formatBattleReportRowSummary(report)).toBe(
      "攻胜 · 攻:演示君主 vs 守:玩家#10002 · 坐标(8,9)",
    );
    expect(
      formatBattleReportRowSummary({
        defender_city_id: 3,
        location_x: 1,
        location_y: 2,
        outcome: 3,
      }),
    ).toContain("平局");
    expect(formatBattleReportRowSummary({ outcome: 2 })).toContain("守胜");
  });

  it("formatBattleReportRoundSummaryStrip for detail round scan line (CLIENT-208)", () => {
    expect(
      formatBattleReportRoundSummaryStrip({
        rounds: [{ round: 1 }, { round: 2 }, { round: 3 }],
        attacker_casualties: { infantry: 10 },
        defender_casualties: { cavalry: 5 },
      }),
    ).toBe("第 1–3 回合 · 攻方伤亡 步兵 10 · 守方伤亡 骑兵 5");
    expect(
      formatBattleReportRoundSummaryStrip({
        rounds: [{ round: 2 }],
        attacker_casualties: {},
        defender_casualties: { infantry: 1 },
      }),
    ).toBe("第 2 回合 · 攻方伤亡 无 · 守方伤亡 步兵 1");
    expect(formatBattleReportRoundSummaryStrip(undefined)).toBe("");
    expect(formatBattleReportRoundSummaryStrip({ rounds: [] })).toBe("");
    expect(
      formatBattleReportRoundSummaryStrip({
        attacker_casualties: { infantry: 3 },
        defender_casualties: {},
      }),
    ).toBe("回合：— · 攻方伤亡 步兵 3 · 守方伤亡 无");
  });

  it("formatBattleReportOutcomeHeadline for detail outcome band (CLIENT-190)", () => {
    expect(
      formatBattleReportOutcomeHeadline({
        report_id: 7,
        defender_player_id: 10002,
        outcome: 1,
      }),
    ).toBe("攻胜 · 战报 #7 · 守方玩家#10002");
    expect(
      formatBattleReportOutcomeHeadline({
        report_id: 3,
        outcome: 3,
        defender_city_id: 9,
      }),
    ).toBe("平局 · 战报 #3 · 城池#9");
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

  it("filters battle reports by local time window", () => {
    const now = Date.UTC(2024, 5, 10, 15, 0, 0);
    const todayMorning = Date.UTC(2024, 5, 10, 8, 0, 0);
    const yesterday = Date.UTC(2024, 5, 9, 12, 0, 0);
    const eightDaysAgo = Date.UTC(2024, 5, 2, 12, 0, 0);
    const reports = [
      { report_id: 1, created_at_ms: todayMorning, outcome: 1 },
      { report_id: 2, created_at_ms: yesterday, outcome: 2 },
      { report_id: 3, created_at_ms: eightDaysAgo, outcome: 3 },
      { report_id: 4, created_at_ms: 0, outcome: 1 },
    ];
    expect(filterBattleReportsByTimeWindow(reports, "all", now).map((r) => r.report_id)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(filterBattleReportsByTimeWindow(reports, "today", now).map((r) => r.report_id)).toEqual([
      1,
    ]);
    expect(filterBattleReportsByTimeWindow(reports, "last7d", now).map((r) => r.report_id)).toEqual(
      [1, 2],
    );
    expect(battleReportMatchesTimeWindowFilter({ created_at_ms: yesterday }, "today", now)).toBe(
      false,
    );
    const byTime = filterBattleReportsByTimeWindow(reports, "last7d", now);
    expect(countBattleReportsByOutcome(byTime)).toEqual({ win: 1, loss: 1, draw: 0 });
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

  it("filters and picks recent battle report at grid", () => {
    const reports = [
      { report_id: 1, location_x: 2, location_y: 2, created_at_ms: 10 },
      { report_id: 2, location_x: 2, location_y: 2, created_at_ms: 20 },
      { report_id: 3, location_x: 3, location_y: 3, created_at_ms: 30 },
    ];
    expect(filterBattleReportsByLocation(reports, 2, 2).map((r) => r.report_id)).toEqual([1, 2]);
    expect(findMostRecentBattleReportAtGrid(reports, 2, 2)?.report_id).toBe(2);
  });

  it("round-trips StartMarchRequest", () => {
    const { StartMarchRequest } = getTypes();
    const msg = StartMarchRequest.create({
      city_id: 42,
      to_x: 5,
      to_y: 5,
      purpose: 1,
      hero_id: 9001,
      troops: [{ unit_cfg_id: 1, count: 50 }],
    });
    const decoded = StartMarchRequest.decode(StartMarchRequest.encode(msg).finish());
    expect(Number(decoded.city_id)).toBe(42);
    expect(decoded.to_x).toBe(5);
    expect(Number(decoded.hero_id)).toBe(9001);
    expect(decoded.troops?.[0]?.count).toBe(50);
  });
});
