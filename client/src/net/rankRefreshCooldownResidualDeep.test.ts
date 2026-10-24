import { describe, expect, it } from "vitest";
import { formatRankRefreshCooldownResidualDeepStamp } from "@/net/rankRefreshCooldownResidualDeep";
import { RANK_MANUAL_REFRESH_COOLDOWN_MS } from "@/net/rankRefreshCooldown";

describe("formatRankRefreshCooldownResidualDeepStamp (CLIENT-264)", () => {
  const now = 1_700_000_000_000;

  it("returns empty when no manual cooldown", () => {
    expect(formatRankRefreshCooldownResidualDeepStamp(0, 0, 1, now)).toBe("");
    expect(
      formatRankRefreshCooldownResidualDeepStamp(
        now,
        now - RANK_MANUAL_REFRESH_COOLDOWN_MS,
        3,
        now,
      ),
    ).toBe("");
  });

  it("consolidates cooldown, last refresh, and manual count during cooldown", () => {
    const lastRefresh = now - 1_000;
    const lastManual = now - 2_000;
    const line = formatRankRefreshCooldownResidualDeepStamp(
      lastRefresh,
      lastManual,
      2,
      now,
    );
    expect(line).toContain("冷却剩余");
    expect(line).toContain("上次刷新");
    expect(line).toContain("手动刷新 ×2");
    expect(line).toContain(" · ");
  });

  it("omits count segment when session count is zero", () => {
    const lastManual = now - 1_000;
    const line = formatRankRefreshCooldownResidualDeepStamp(now, lastManual, 0, now);
    expect(line).toContain("冷却剩余");
    expect(line).not.toContain("手动刷新");
  });
});
