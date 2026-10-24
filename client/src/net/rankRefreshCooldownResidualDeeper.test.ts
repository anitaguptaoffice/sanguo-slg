import { describe, expect, it } from "vitest";
import { formatRankRefreshCooldownResidualDeeperStamp } from "@/net/rankRefreshCooldownResidualDeeper";
import { RANK_MANUAL_REFRESH_COOLDOWN_MS } from "@/net/rankRefreshCooldown";

describe("formatRankRefreshCooldownResidualDeeperStamp (CLIENT-280)", () => {
  const now = 1_700_000_000_000;

  it("returns empty when no manual cooldown", () => {
    expect(formatRankRefreshCooldownResidualDeeperStamp(0, 0, 1, now)).toBe("");
    expect(
      formatRankRefreshCooldownResidualDeeperStamp(
        now,
        now - RANK_MANUAL_REFRESH_COOLDOWN_MS,
        3,
        now,
      ),
    ).toBe("");
  });

  it("consolidates cooldown, last refresh, manual count, and CLIENT-264 deep during cooldown", () => {
    const lastRefresh = now - 1_000;
    const lastManual = now - 2_000;
    const line = formatRankRefreshCooldownResidualDeeperStamp(
      lastRefresh,
      lastManual,
      2,
      now,
    );
    expect(line).toContain("巩固再加深");
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
    const line = formatRankRefreshCooldownResidualDeeperStamp(now, lastManual, 0, now);
    expect(line).toContain("冷却剩余");
    expect(line).not.toContain("手动刷新");
    expect(line).toContain("钉选保持扫读");
  });
});
