import {
  formatCasualtyMap,
  type BattleRoundView,
} from "@/net/militaryFormat";

/** 超过该回合数时详情区默认折叠回合表。 */
export const BATTLE_REPORT_ROUNDS_COLLAPSE_THRESHOLD = 8;

export const BATTLE_REPORT_ROUNDS_EXPAND_LABEL = "展开全部回合";

export type BattleRoundTableRow = {
  round: number;
  attackerAction: string;
  defenderAction: string;
  attackerRemaining: string;
  defenderRemaining: string;
};

export function formatBattleRoundActionSummary(
  side: "attacker" | "defender",
  round: BattleRoundView | undefined,
): string {
  if (!round) return "—";
  const toDef = round.attacker_to_def_hp ?? 0;
  const toAtt = round.defender_to_att_hp ?? 0;
  if (side === "attacker") {
    if (toDef > 0) return `造成伤害 ${toDef}`;
    if (toAtt > 0) return "未造成伤害";
    return "对峙";
  }
  if (toAtt > 0) return `造成伤害 ${toAtt}`;
  if (toDef > 0) return "未造成伤害";
  return "对峙";
}

export function buildBattleRoundTableRow(round: BattleRoundView | undefined): BattleRoundTableRow {
  const n = round?.round ?? 0;
  return {
    round: n,
    attackerAction: formatBattleRoundActionSummary("attacker", round),
    defenderAction: formatBattleRoundActionSummary("defender", round),
    attackerRemaining: formatCasualtyMap(round?.attacker_troops),
    defenderRemaining: formatCasualtyMap(round?.defender_troops),
  };
}

export function buildBattleRoundTableRows(
  rounds: BattleRoundView[] | undefined,
): BattleRoundTableRow[] {
  if (!rounds?.length) return [];
  return rounds.map((r) => buildBattleRoundTableRow(r));
}

export function shouldCollapseBattleRounds(roundCount: number): boolean {
  return roundCount > BATTLE_REPORT_ROUNDS_COLLAPSE_THRESHOLD;
}

/** 折叠时默认展示的回合行（前 N 条）；展开后返回全部。 */
export function visibleBattleRoundTableRows(
  rows: BattleRoundTableRow[],
  expanded: boolean,
): BattleRoundTableRow[] {
  if (expanded || !shouldCollapseBattleRounds(rows.length)) return rows;
  return [];
}
