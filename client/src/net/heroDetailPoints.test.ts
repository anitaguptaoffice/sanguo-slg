import { describe, expect, it } from "vitest";
import {
  applyHeroPointResultToDetail,
  buildAddHeroPointTargets,
  formatHeroPointGatewayErrorFromUnknown,
  heroPointAddDisabled,
  heroPointClearDisabled,
  heroPointRemaining,
  heroPointSnapshotFromResult,
  heroPointSnapshotFromDetail,
  heroPointRemainingAtLevel,
  formatHeroPointAllocSummary,
  heroPointUsed,
  heroPointUnsupportedReason,
  heroPointAddDisabledReason,
  heroPointClearDisabledReason,
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

  it("mergeHeroPointSnapshot preserves unknown allocation", () => {
    const merged = mergeHeroPointSnapshot({ hero_id: 1, level: 4 }, null);
    expect(merged.potential_remaining).toBeUndefined();
    expect(heroPointUsed(merged)).toBeUndefined();
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
    expect(heroPointClearDisabled("idle", mergeHeroPointSnapshot(baseDetail, null))).toBe(false);
    expect(heroPointClearDisabled("idle", { ...baseDetail, force_add: 0, intel_add: 0, politics_add: 0 })).toBe(true);
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

it("response budget, not current/captured level, anchors allocation and clear snapshots", () => {
 const allocation = heroPointSnapshotFromResult({ hero_id: 7, potential_remaining: 1, force_add: 2, intel_add: 0, politics_add: 0 });
 expect(allocation?.level).toBe(3); expect(mergeHeroPointSnapshot({ hero_id: 7, level: 4 }, allocation).potential_remaining).toBe(2);
 const cleared = heroPointSnapshotFromResult({ hero_id: 7, potential_remaining: 3, force_add: 0, intel_add: 0, politics_add: 0 });
 expect(mergeHeroPointSnapshot({ hero_id: 7, level: 4 }, cleared).potential_remaining).toBe(4);
 expect(heroPointSnapshotFromResult({ hero_id: 7, potential_remaining: -1, force_add: 0, intel_add: 0, politics_add: 0 })).toBeNull();
});

it("unknown and partial allocation never become a zero snapshot", () => {
  for (const detail of [{ hero_id: 7, level: 3 }, { hero_id: 7, level: 3, force_add: 0 }]) {
    expect(heroPointSnapshotFromDetail(detail)).toBeNull();
    expect(heroPointRemaining(detail)).toBeUndefined();
    expect(heroPointClearDisabled("idle", detail)).toBe(false);
    expect(heroPointAddDisabled("idle", detail)).toBe(false);
    expect(formatHeroPointAllocSummary(detail)).toContain("未知");
  }
});
it("known exhausted and zero allocations keep their exact behavior", () => {
  const exhausted = { hero_id: 7, level: 3, potential_remaining: 0, force_add: 3, intel_add: 0, politics_add: 0 };
  const empty = { ...exhausted, potential_remaining: 3, force_add: 0 };
  expect(heroPointAddDisabled("idle", exhausted)).toBe(true);
  expect(heroPointClearDisabled("idle", exhausted)).toBe(false);
  expect(heroPointClearDisabled("idle", empty)).toBe(true);
  expect(heroPointSnapshotFromDetail(empty)).toMatchObject({ potential_remaining: 3, force_add: 0 });
  expect(heroPointClearDisabled("submitting", { hero_id: 7, level: 3 })).toBe(true);
  expect(heroPointClearDisabled("idle", { hero_id: 7, status: HERO_STATUS_MARCH })).toBe(true);
});

it("incomplete legacy snapshots use known remaining without treating fractional adds as valid", () => {
  expect(heroPointRemainingAtLevel({ level: 3, potential_remaining: 1, force_add: 0.5, intel_add: 0, politics_add: 0 }, 4)).toBe(2);
});

it("only the explicit hotel marker proves unsupported potential operations", () => {
  for (const template_cfg_id of [undefined, 0, 1001]) {
    const detail = { hero_id: 7, level: 3, template_cfg_id, template_code: "hotel_random" };
    const reason = heroPointUnsupportedReason(detail);
    expect(reason).toBe("随机客栈将领暂不支持潜力加点或洗点");
    expect(heroPointAddDisabled("idle", detail)).toBe(true);
    expect(heroPointClearDisabled("idle", detail)).toBe(true);
    expect(heroPointAddDisabledReason(detail)).toBe(reason);
    expect(heroPointClearDisabledReason(detail)).toBe(reason);
    expect(formatHeroPointAllocSummary(detail)).toBe(reason);
    expect(heroPointSnapshotFromDetail(detail)).toBeNull();
    for (const template_code of [undefined, "", "xuan_de_lord", "HOTEL_RANDOM"]) {
      const unknown = { ...detail, template_code };
      expect(heroPointUnsupportedReason(unknown)).toBeNull();
      expect(heroPointAddDisabled("idle", unknown)).toBe(false);
      expect(heroPointClearDisabled("idle", unknown)).toBe(false);
    }
  }
});
