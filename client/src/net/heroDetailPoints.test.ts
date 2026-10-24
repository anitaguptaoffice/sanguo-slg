import { describe, expect, it } from "vitest";
import {
  applyHeroPointResultToDetail,
  buildAddHeroPointTargets,
  formatHeroPointGatewayErrorFromUnknown,
  heroPointAddDisabled,
  heroPointClearDisabled,
  heroPointRemaining,
  heroPointUsed,
  mergeHeroPointSnapshot,
  parseHeroPointResponse,
  renderHeroDetailPointsMarkup,
} from "@/net/heroDetailPoints";
import { HERO_STATUS_MARCH } from "@/net/marchHeroPick";

describe("heroDetailPoints (CLIENT-hero-points-001)", () => {
  const baseDetail = {
    hero_id: 9,
    level: 5,
    status: 1,
    attributes: { force: 70, intel: 60, politics: 55, command: 50 },
  };

  it("parseHeroPointResponse maps gateway fields", () => {
    const res = parseHeroPointResponse({
      hero_id: 9,
      potential_remaining: 2,
      force_add: 1,
      intel_add: 1,
      politics_add: 1,
      attributes: { force: 71, intel: 61, politics: 56, command: 50 },
    });
    expect(res.potential_remaining).toBe(2);
    expect(res.force_add).toBe(1);
    expect(applyHeroPointResultToDetail(baseDetail, res).attributes?.force).toBe(71);
  });

  it("mergeHeroPointSnapshot defaults remaining to level budget", () => {
    const merged = mergeHeroPointSnapshot({ hero_id: 1, level: 4 }, null);
    expect(merged.potential_remaining).toBe(4);
    expect(heroPointUsed(merged)).toBe(0);
  });

  it("buildAddHeroPointTargets increments selected stat", () => {
    const targets = buildAddHeroPointTargets(baseDetail, "force");
    expect(targets).toEqual({ force: 71, intel: 60, politics: 55 });
  });

  it("heroPointAddDisabled when marching or no potential", () => {
    expect(heroPointAddDisabled("idle", baseDetail)).toBe(false);
    expect(heroPointAddDisabled("idle", { ...baseDetail, potential_remaining: 0 })).toBe(true);
    expect(
      heroPointAddDisabled("idle", { ...baseDetail, status: HERO_STATUS_MARCH, potential_remaining: 3 }),
    ).toBe(true);
  });

  it("heroPointClearDisabled without allocated points", () => {
    expect(heroPointClearDisabled("idle", mergeHeroPointSnapshot(baseDetail, null))).toBe(true);
    expect(
      heroPointClearDisabled("idle", { ...baseDetail, force_add: 1, intel_add: 0, politics_add: 0 }),
    ).toBe(false);
  });

  it("formatHeroPointGatewayErrorFromUnknown maps insufficient potential", () => {
    expect(formatHeroPointGatewayErrorFromUnknown(new Error("hero: insufficient potential points"))).toContain(
      "潜力点不足",
    );
  });

  it("renderHeroDetailPointsMarkup exposes add/clear actions", () => {
    const html = renderHeroDetailPointsMarkup("idle", {
      ...baseDetail,
      potential_remaining: 3,
      force_add: 1,
      intel_add: 1,
      politics_add: 0,
    });
    expect(html).toContain('data-action="hero-point-add"');
    expect(html).toContain('data-action="hero-point-clear"');
    expect(html).toContain("剩余");
    expect(heroPointRemaining({ ...baseDetail, potential_remaining: 3 })).toBe(3);
  });
});
