import { describe, expect, it } from "vitest";
import {
  formatRankManualRefreshCountLine,
  incrementRankManualRefreshCount,
  readRankManualRefreshCount,
  RANK_MANUAL_REFRESH_COUNT_SESSION_KEY,
} from "@/net/rankManualRefreshCountSession";

describe("rankManualRefreshCountSession (CLIENT-264)", () => {
  it("formatRankManualRefreshCountLine", () => {
    expect(formatRankManualRefreshCountLine(0)).toBe("");
    expect(formatRankManualRefreshCountLine(3)).toBe("手动刷新 ×3");
  });

  it("incrementRankManualRefreshCount persists per board type", () => {
    const storage = new Map<string, string>();
    const mock = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
    };
    expect(incrementRankManualRefreshCount(1, mock)).toBe(1);
    expect(incrementRankManualRefreshCount(1, mock)).toBe(2);
    expect(incrementRankManualRefreshCount(2, mock)).toBe(1);
    expect(readRankManualRefreshCount(1, mock)).toBe(2);
    expect(storage.get(RANK_MANUAL_REFRESH_COUNT_SESSION_KEY)).toContain('"1":2');
  });
});
