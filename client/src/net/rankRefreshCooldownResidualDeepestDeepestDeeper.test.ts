import { describe, expect, it } from "vitest";
import { formatRankRefreshCooldownResidualDeepestDeepestDeeperStamp } from "@/net/rankRefreshCooldownResidualDeepestDeepestDeeper";
import { RANK_MANUAL_REFRESH_COOLDOWN_MS } from "@/net/rankRefreshCooldown";

describe("formatRankRefreshCooldownResidualDeepestDeepestDeeperStamp (CLIENT-328)", () => {
  const now = 1_700_000_000_000;

  it("returns empty when no manual cooldown", () => {
    expect(formatRankRefreshCooldownResidualDeepestDeepestDeeperStamp(0, 0, 1, now)).toBe("");
    expect(
      formatRankRefreshCooldownResidualDeepestDeepestDeeperStamp(
        now,
        now - RANK_MANUAL_REFRESH_COOLDOWN_MS,
        3,
        now,
      ),
    ).toBe("");
  });

  it("consolidates cooldown, last refresh, manual count, and CLIENT-312 deepest-deeper during cooldown", () => {
    const lastRefresh = now - 1_000;
    const lastManual = now - 2_000;
    const line = formatRankRefreshCooldownResidualDeepestDeepestDeeperStamp(
      lastRefresh,
      lastManual,
      2,
      now,
    );
    expect(line).toContain("巩固再加深三层");
    expect(line).toContain("冷却窗");
    expect(line).toContain("冷却剩余");
    expect(line).toContain("上次刷新");
    expect(line).toContain("手动刷新 ×2");
    expect(line).toContain("钉选保持扫读");
    expect(line).toContain("巩固 ");
    expect(line).toContain(" · ");
  });

  it("omits manual count segment when session count is zero", () => {
    const lastManual = now - 1_000;
    const line = formatRankRefreshCooldownResidualDeepestDeepestDeeperStamp(now, lastManual, 0, now);
    expect(line).toContain("冷却剩余");
    expect(line).not.toContain("手动刷新");
    expect(line).toContain("钉选保持扫读");
  });
});
