import { describe, expect, it } from "vitest";
import {
  formatRankRefreshCooldownStamp,
  RANK_MANUAL_REFRESH_COOLDOWN_MS,
  RANK_MANUAL_REFRESH_SESSION_KEY,
  rankRefreshCooldownRemainingMs,
  readRankManualLastRefreshMs,
  writeRankManualLastRefreshMs,
} from "@/net/rankRefreshCooldown";

describe("formatRankRefreshCooldownStamp", () => {
  const now = 1_700_000_000_000;

  it("returns empty when no prior manual refresh", () => {
    expect(formatRankRefreshCooldownStamp(0, now)).toBe("");
    expect(formatRankRefreshCooldownStamp(-1, now)).toBe("");
  });

  it("shows remaining seconds within cooldown window", () => {
    const last = now - 2_000;
    expect(rankRefreshCooldownRemainingMs(last, now)).toBe(3_000);
    expect(formatRankRefreshCooldownStamp(last, now)).toBe("冷却剩余：3 秒");
  });

  it("returns empty after cooldown elapsed", () => {
    const last = now - RANK_MANUAL_REFRESH_COOLDOWN_MS;
    expect(formatRankRefreshCooldownStamp(last, now)).toBe("");
    expect(formatRankRefreshCooldownStamp(last - 1, now)).toBe("");
  });

  it("ceil partial seconds", () => {
    expect(formatRankRefreshCooldownStamp(now - 4_900, now)).toBe("冷却剩余：1 秒");
  });
});

describe("rank manual refresh session", () => {
  it("reads and writes per board type", () => {
    const storage = {
      store: "",
      getItem(key: string) {
        return key === RANK_MANUAL_REFRESH_SESSION_KEY ? this.store : null;
      },
      setItem(key: string, value: string) {
        if (key === RANK_MANUAL_REFRESH_SESSION_KEY) this.store = value;
      },
    };
    writeRankManualLastRefreshMs(1, 100, storage);
    writeRankManualLastRefreshMs(2, 200, storage);
    expect(readRankManualLastRefreshMs(1, storage)).toBe(100);
    expect(readRankManualLastRefreshMs(2, storage)).toBe(200);
    expect(readRankManualLastRefreshMs(3, storage)).toBe(0);
  });
});
