import {
  formatCasualtyMap,
  formatBattleRoundLine,
  type BattleReportDetailView,
  type BattleReportSummary,
} from "@/net/militaryFormat";

export type BattleReportTroopScan = {
  attackerLabel: string;
  defenderLabel: string;
  attackerTroops: string;
  defenderTroops: string;
  openingRoundLine: string;
};

export function formatBattleReportSideLabel(
  side: "attacker" | "defender",
  summary: BattleReportSummary | undefined,
): string {
  if (side === "attacker") {
    return summary?.attacker_player_id
      ? `攻方玩家#${summary.attacker_player_id}`
      : "攻方";
  }
  if (summary?.defender_player_id) return `守方玩家#${summary.defender_player_id}`;
  if (summary?.defender_city_id) return `城池#${summary.defender_city_id}`;
  return "守方";
}

/** 开局兵力：优先第 1 回合快照，否则 final_* 终局兵力。 */
export function pickBattleTroopSnapshot(detail: BattleReportDetailView | undefined): {
  attacker: Record<string, number> | undefined;
  defender: Record<string, number> | undefined;
} {
  const first = detail?.rounds?.[0];
  if (first?.attacker_troops || first?.defender_troops) {
    return {
      attacker: first.attacker_troops,
      defender: first.defender_troops,
    };
  }
  return {
    attacker: detail?.final_attacker,
    defender: detail?.final_defender,
  };
}

export function buildBattleReportTroopScan(
  summary: BattleReportSummary | undefined,
  detail: BattleReportDetailView | undefined,
): BattleReportTroopScan {
  const snap = pickBattleTroopSnapshot(detail);
  const opening = detail?.rounds?.[0];
  return {
    attackerLabel: formatBattleReportSideLabel("attacker", summary),
    defenderLabel: formatBattleReportSideLabel("defender", summary),
    attackerTroops: formatCasualtyMap(snap.attacker),
    defenderTroops: formatCasualtyMap(snap.defender),
    openingRoundLine: opening ? formatBattleRoundLine(opening) : "",
  };
}
