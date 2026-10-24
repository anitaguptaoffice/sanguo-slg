import { describe, expect, it } from "vitest";
import { formatRankPinRefreshResidualLine } from "@/net/rankPinRefreshResidual";

describe("formatRankPinRefreshResidualLine (CLIENT-242)", () => {
  const now = 1_700_000_000_000;

  it("returns null when not ranked", () => {
    expect(formatRankPinRefreshResidualLine(0, now, now, now)).toBeNull();
    expect(formatRankPinRefreshResidualLine(undefined, now, now, now)).toBeNull();
  });

  it("combines pin, last refresh, and cooldown stamp", () => {
    const lastRefresh = now - 60_000;
    const lastManual = now - 2_000;
    const line = formatRankPinRefreshResidualLine(3, lastRefresh, lastManual, now);
    expect(line).toContain("钉选 #3");
    expect(line).toContain("上次刷新");
    expect(line).toContain("冷却剩余");
  });

  it("omits cooldown when elapsed", () => {
    const line = formatRankPinRefreshResidualLine(2, now - 30_000, now - 10_000, now);
    expect(line).toContain("钉选 #2");
    expect(line).not.toContain("冷却剩余");
  });
});
