import { describe, expect, it } from "vitest";
import {
  buildBattleReportTroopScan,
  formatBattleReportSideLabel,
  pickBattleTroopSnapshot,
} from "@/net/battleReportDetailSummary";

describe("battleReportDetailSummary", () => {
  const summary = {
    report_id: 1,
    attacker_player_id: 10,
    defender_player_id: 20,
    location_x: 3,
    location_y: 4,
  };

  it("formats side labels from summary ids", () => {
    expect(formatBattleReportSideLabel("attacker", summary)).toBe("攻方玩家#10");
    expect(formatBattleReportSideLabel("defender", summary)).toBe("守方玩家#20");
    expect(formatBattleReportSideLabel("defender", { defender_city_id: 5 })).toBe("城池#5");
  });

  it("prefers opening round troops over final maps", () => {
    const detail = {
      rounds: [
        {
          round: 1,
          attacker_troops: { infantry: 100 },
          defender_troops: { cavalry: 50 },
        },
      ],
      final_attacker: { infantry: 10 },
      final_defender: { cavalry: 5 },
    };
    expect(pickBattleTroopSnapshot(detail)).toEqual({
      attacker: { infantry: 100 },
      defender: { cavalry: 50 },
    });
    const scan = buildBattleReportTroopScan(summary, detail);
    expect(scan.attackerTroops).toContain("步兵 100");
    expect(scan.defenderTroops).toContain("骑兵 50");
    expect(scan.openingRoundLine).toContain("第 1 回合");
  });

  it("falls back to final troop maps when no rounds", () => {
    const detail = {
      final_attacker: { archer: 30 },
      final_defender: { siege: 2 },
    };
    const scan = buildBattleReportTroopScan(summary, detail);
    expect(scan.attackerTroops).toContain("弓兵 30");
    expect(scan.defenderTroops).toContain("器械 2");
    expect(scan.openingRoundLine).toBe("");
  });
});
