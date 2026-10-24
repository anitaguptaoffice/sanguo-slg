import { describe, expect, it } from "vitest";
import {
  HERO_MARCH_FORCE_MARCH_COST,
  applyRestHeroToDetail,
  formatHeroMarchForceSummary,
  heroMarchForceMaxFromLevel,
  heroRestDisabledReason,
  parseRestHeroResponse,
  renderHeroDetailForceMarkup,
  validateMarchHeroMarchForce,
} from "@/net/heroDetailForce";
import { HERO_MARCH_FORCE_SESSION_KEY } from "@/net/heroMarchForceSession";
import { HERO_STATUS_IDLE, HERO_STATUS_MARCH } from "@/net/marchHeroPick";

describe("heroDetailForce (CLIENT-hero-force-001)", () => {
  const baseDetail = {
    hero_id: 3,
    level: 5,
    status: HERO_STATUS_IDLE,
    march_force: 24,
    march_force_max: 40,
  };

  it("heroMarchForceMaxFromLevel matches server formula", () => {
    expect(heroMarchForceMaxFromLevel(1)).toBe(24);
    expect(heroMarchForceMaxFromLevel(20)).toBe(100);
    expect(heroMarchForceMaxFromLevel(30)).toBe(100);
  });

  it("parseRestHeroResponse and applyRestHeroToDetail", () => {
    const res = parseRestHeroResponse({ hero_id: 3, march_force: 40, march_force_max: 40 });
    const merged = applyRestHeroToDetail(baseDetail, res);
    expect(merged.march_force).toBe(40);
    expect(merged.march_force_max).toBe(40);
  });

  it("formatHeroMarchForceSummary includes cost", () => {
    expect(formatHeroMarchForceSummary(baseDetail)).toContain("24/40");
    expect(formatHeroMarchForceSummary(baseDetail)).toContain(String(HERO_MARCH_FORCE_MARCH_COST));
  });

  it("heroRestDisabledReason requires idle and not full", () => {
    expect(heroRestDisabledReason({ ...baseDetail, status: HERO_STATUS_MARCH })).toContain("空闲");
    expect(heroRestDisabledReason({ ...baseDetail, march_force: 40 })).toContain("已满");
    expect(heroRestDisabledReason(baseDetail)).toBe("");
  });

  it("validateMarchHeroMarchForce uses session snapshot", () => {
    const storage = {
      getItem: (key: string) =>
        key === HERO_MARCH_FORCE_SESSION_KEY
          ? JSON.stringify({ "3": { current: 5, max: 40, updatedAtMs: 1 } })
          : null,
      setItem: () => {},
    };
    const fail = validateMarchHeroMarchForce(3, storage);
    expect(fail.ok).toBe(false);
    if (!fail.ok) {
      expect(fail.message).toContain("体力不足");
      expect(fail.message).toContain(String(HERO_MARCH_FORCE_MARCH_COST));
    }
    const ok = validateMarchHeroMarchForce(99, storage);
    expect(ok.ok).toBe(true);
  });

  it("renderHeroDetailForceMarkup exposes rest action", () => {
    const html = renderHeroDetailForceMarkup("idle", baseDetail);
    expect(html).toContain('data-action="hero-force-rest"');
    expect(html).toContain('data-role="hero-force-summary"');
  });
});
