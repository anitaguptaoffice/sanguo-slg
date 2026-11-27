import { describe, expect, it } from "vitest";
import {
  BATTLE_REPLAY_INITIAL,
  battleReplayTickIntervalMs,
  reduceBattleReplayState,
  troopBarPercent,
} from "@/net/battleReportReplay";

describe("battleReportReplay state", () => {
  it("advances on tick while playing", () => {
    let s = reduceBattleReplayState(BATTLE_REPLAY_INITIAL, { type: "play" }, 5);
    s = reduceBattleReplayState(s, { type: "tick" }, 5);
    expect(s.roundIndex).toBe(1);
  });

  it("stops at last round on tick", () => {
    let s = { ...BATTLE_REPLAY_INITIAL, roundIndex: 3, playing: true };
    s = reduceBattleReplayState(s, { type: "tick" }, 4);
    expect(s.roundIndex).toBe(3);
    expect(s.atSettlement).toBe(true);
    expect(s.playing).toBe(false);
  });

  it("jump-settlement lands on final index", () => {
    const s = reduceBattleReplayState(BATTLE_REPLAY_INITIAL, { type: "jump-settlement" }, 8);
    expect(s.roundIndex).toBe(7);
    expect(s.atSettlement).toBe(true);
  });

  it("speed affects tick interval", () => {
    expect(battleReplayTickIntervalMs(1)).toBeGreaterThan(battleReplayTickIntervalMs(4));
  });

  it("troopBarPercent scales against baseline", () => {
    expect(troopBarPercent({ "1": 50, "2": 50 }, 200)).toBe(50);
  });
});