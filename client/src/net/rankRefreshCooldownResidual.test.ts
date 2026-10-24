import { describe, expect, it } from "vitest";
import { formatRankRefreshCooldownResidualStamp } from "@/net/rankRefreshCooldownResidual";
import { RANK_MANUAL_REFRESH_COOLDOWN_MS } from "@/net/rankRefreshCooldown";

describe("formatRankRefreshCooldownResidualStamp (CLIENT-248)", () => {
  const now = 1_700_000_000_000;

  it("returns empty when no manual cooldown", () => {
    expect(formatRankRefreshCooldownResidualStamp(0, 0, now)).toBe("");
    expect(formatRankRefreshCooldownResidualStamp(now, now - RANK_MANUAL_REFRESH_COOLDOWN_MS, now)).toBe(
      "",
    );
  });

  it("combines cooldown remaining and last refresh during cooldown", () => {
    const lastRefresh = now - 1_000;
    const lastManual = now - 2_000;
    const line = formatRankRefreshCooldownResidualStamp(lastRefresh, lastManual, now);
    expect(line).toContain("冷却剩余");
    expect(line).toContain("上次刷新");
    expect(line).toContain(" · ");
  });
});
