import { describe, expect, it } from "vitest";
import {
  BATTLE_REPORT_ROUNDS_COLLAPSE_THRESHOLD,
  BATTLE_REPORT_ROUNDS_EXPAND_LABEL,
  buildBattleRoundTableRow,
  buildBattleRoundTableRows,
  formatBattleRoundActionSummary,
  shouldCollapseBattleRounds,
  visibleBattleRoundTableRows,
} from "@/net/battleReportRounds";

describe("battleReportRounds", () => {
  const sampleRound = {
    round: 3,
    attacker_troops: { infantry: 80 },
    defender_troops: { cavalry: 40 },
    attacker_to_def_hp: 15,
    defender_to_att_hp: 0,
  };

  it("builds structured round table rows", () => {
    const row = buildBattleRoundTableRow(sampleRound);
    expect(row.round).toBe(3);
    expect(row.attackerAction).toBe("造成伤害 15");
    expect(row.defenderAction).toBe("未造成伤害");
    expect(row.attackerRemaining).toContain("步兵");
    expect(row.defenderRemaining).toContain("骑兵");
    expect(buildBattleRoundTableRows([sampleRound])).toHaveLength(1);
  });

  it("summarizes defender damage", () => {
    expect(
      formatBattleRoundActionSummary("defender", {
        round: 1,
        defender_to_att_hp: 9,
        attacker_to_def_hp: 0,
      }),
    ).toBe("造成伤害 9");
    expect(
      formatBattleRoundActionSummary("attacker", {
        round: 1,
        attacker_to_def_hp: 0,
        defender_to_att_hp: 0,
      }),
    ).toBe("对峙");
  });

  it("collapses when round count exceeds threshold", () => {
    const rows = buildBattleRoundTableRows(
      Array.from({ length: BATTLE_REPORT_ROUNDS_COLLAPSE_THRESHOLD + 1 }, (_, i) => ({
        round: i + 1,
      })),
    );
    expect(shouldCollapseBattleRounds(rows.length)).toBe(true);
    expect(visibleBattleRoundTableRows(rows, false)).toHaveLength(0);
    expect(visibleBattleRoundTableRows(rows, true)).toHaveLength(rows.length);
    expect(BATTLE_REPORT_ROUNDS_EXPAND_LABEL).toBe("展开全部回合");
  });
});
