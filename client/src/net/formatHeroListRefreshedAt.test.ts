// @vitest-environment node
import { describe, expect, it } from "vitest";
import { formatHeroListRefreshedAt } from "@/net/formatHeroListRefreshedAt";

describe("formatHeroListRefreshedAt", () => {
  it("uses 列表更新 prefix with relative time", () => {
    const now = Date.UTC(2026, 0, 15, 12, 0, 0);
    expect(formatHeroListRefreshedAt(now - 30_000, now)).toBe("列表更新：刚刚");
    expect(formatHeroListRefreshedAt(now - 5 * 60_000, now)).toBe("列表更新：5 分钟前");
  });

  it("falls back to absolute time after 48h", () => {
    const at = Date.UTC(2026, 0, 10, 8, 30, 0);
    const now = Date.UTC(2026, 0, 15, 12, 0, 0);
    expect(formatHeroListRefreshedAt(at, now)).toContain("列表更新：");
    expect(formatHeroListRefreshedAt(at, now)).toContain("2026");
  });

  it("returns empty for invalid timestamp", () => {
    expect(formatHeroListRefreshedAt(0)).toBe("");
    expect(formatHeroListRefreshedAt(-1)).toBe("");
  });
});
