import type { BattleRoundView } from "@/net/militaryFormat";
import { formatBattleRoundActionSummary } from "@/net/battleReportRounds";

export type BattleReplaySpeed = 1 | 2 | 4;

export type BattleReplayState = {
  roundIndex: number;
  playing: boolean;
  speed: BattleReplaySpeed;
  atSettlement: boolean;
};

export const BATTLE_REPLAY_INITIAL: BattleReplayState = {
  roundIndex: 0,
  playing: false,
  speed: 1,
  atSettlement: false,
};

export type BattleReplayEvent =
  | { type: "play" }
  | { type: "pause" }
  | { type: "toggle-play" }
  | { type: "set-speed"; speed: BattleReplaySpeed }
  | { type: "prev-round" }
  | { type: "next-round" }
  | { type: "jump-settlement" }
  | { type: "tick" }
  | { type: "select-round"; index: number };

export function reduceBattleReplayState(
  state: BattleReplayState,
  event: BattleReplayEvent,
  roundCount: number,
): BattleReplayState {
  const max = Math.max(0, roundCount - 1);
  const clampIdx = (i: number) => Math.min(max, Math.max(0, i));
  switch (event.type) {
    case "play":
      return { ...state, playing: true, atSettlement: false };
    case "pause":
      return { ...state, playing: false };
    case "toggle-play":
      return { ...state, playing: !state.playing, atSettlement: false };
    case "set-speed":
      return { ...state, speed: event.speed };
    case "prev-round":
      return {
        ...state,
        roundIndex: clampIdx(state.roundIndex - 1),
        atSettlement: false,
        playing: false,
      };
    case "next-round": {
      const next = clampIdx(state.roundIndex + 1);
      return {
        ...state,
        roundIndex: next,
        atSettlement: next >= max,
        playing: state.playing && next < max,
      };
    }
    case "jump-settlement":
      return { ...state, roundIndex: max, playing: false, atSettlement: true };
    case "select-round":
      return {
        ...state,
        roundIndex: clampIdx(event.index),
        atSettlement: clampIdx(event.index) >= max,
        playing: false,
      };
    case "tick":
      if (!state.playing || state.atSettlement || roundCount <= 0) return state;
      if (state.roundIndex >= max) {
        return { ...state, playing: false, atSettlement: true };
      }
      return { ...state, roundIndex: state.roundIndex + 1 };
    default:
      return state;
  }
}

export function battleReplayTickIntervalMs(speed: BattleReplaySpeed): number {
  return Math.round(1400 / speed);
}

export function formatReplayRoundCaption(round: BattleRoundView | undefined): string {
  if (!round) return "对峙";
  const att = formatBattleRoundActionSummary("attacker", round);
  const def = formatBattleRoundActionSummary("defender", round);
  return `第 ${round.round ?? "?"} 回合 · 攻：${att} · 守：${def}`;
}

export function troopBarPercent(units: Record<string, number> | undefined, baseline: number): number {
  if (!units || baseline <= 0) return 0;
  const sum = Object.values(units).reduce((a, b) => a + (b ?? 0), 0);
  return Math.min(100, Math.round((sum / baseline) * 100));
}

export function sumUnitMap(units: Record<string, number> | undefined): number {
  if (!units) return 0;
  return Object.values(units).reduce((a, b) => a + (b ?? 0), 0);
}