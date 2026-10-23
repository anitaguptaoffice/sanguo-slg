import { describe, expect, it } from "vitest";
import { LB_PLAYER_POWER, LB_PLAYER_RESOURCE } from "@/net/leaderboardFormat";
import {
  formatRankLastRefreshLine,
  parseRankLastRefreshSession,
  readRankLastRefreshMs,
  RANK_LAST_REFRESH_SESSION_KEY,
  writeRankLastRefreshMs,
} from "@/net/rankLastRefreshSession";

describe("rankLastRefreshSession", () => {
  it("round-trips per-board refresh timestamps", () => {
    const storage = new Map<string, string>();
    const mock = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
    };
    writeRankLastRefreshMs(LB_PLAYER_POWER, 1_700_000_000_000, mock);
    writeRankLastRefreshMs(LB_PLAYER_RESOURCE, 1_700_000_100_000, mock);
    expect(readRankLastRefreshMs(LB_PLAYER_POWER, mock)).toBe(1_700_000_000_000);
    expect(readRankLastRefreshMs(LB_PLAYER_RESOURCE, mock)).toBe(1_700_000_100_000);
    expect(storage.get(RANK_LAST_REFRESH_SESSION_KEY)).toContain(String(LB_PLAYER_POWER));
  });

  it("parses invalid session as empty", () => {
    expect(parseRankLastRefreshSession("not-json")).toEqual({});
    expect(parseRankLastRefreshSession(JSON.stringify({ "1": "x" }))).toEqual({});
  });

  it("formats last refresh line for rank viewer bar", () => {
    const at = Date.UTC(2026, 0, 15, 10, 30, 0);
    expect(formatRankLastRefreshLine(at)).toContain("上次刷新：");
    expect(formatRankLastRefreshLine(0)).toBe("");
  });
});
