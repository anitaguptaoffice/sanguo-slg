import { describe, expect, it } from "vitest";
import type { HeroDetail } from "@/net/heroMailState";
import { parseGetHeroDetailResponse } from "@/net/heroMailState";
import {
  HERO_MAX_LEVEL_M1,
  applyUpgradeHeroToDetail,
  formatHeroUpgradeGatewayErrorFromUnknown,
  formatHeroUpgradeSuccessStatus,
  heroUpgradeButtonDisabled,
  heroUpgradeDisabledReason,
  parseUpgradeHeroResponse,
  renderHeroDetailUpgradeMarkup,
} from "@/net/heroDetailUpgrade";

describe("heroDetailUpgrade", () => {
  it("parseGetHeroDetailResponse maps hero.v1 exp fields", () => {
    const detail = parseGetHeroDetailResponse({
      hero_id: 1,
      level: 3,
      exp: 500,
      exp_toward_next: 80,
      upgrade_exp_required: 100,
    });
    expect(detail.exp).toBe(500);
    expect(detail.exp_current).toBe(80);
    expect(detail.exp_to_next).toBe(100);
  });

  it("parseUpgradeHeroResponse maps UpgradeHeroResponse", () => {
    const res = parseUpgradeHeroResponse({
      hero_id: 9,
      level: 4,
      exp: 1200,
      previous_level: 3,
      exp_toward_next: 20,
      upgrade_exp_required: 400,
      attributes: { force: 70, intel: 60, politics: 55, command: 62 },
    });
    expect(res.level).toBe(4);
    expect(res.previous_level).toBe(3);
    expect(res.exp_current).toBe(20);
    expect(res.exp_to_next).toBe(400);
    expect(res.attributes?.force).toBe(70);
  });

  it("applyUpgradeHeroToDetail preserves template fields", () => {
    const before: HeroDetail = {
      hero_id: 9,
      template_name: "刘备",
      level: 3,
      loyalty: 90,
    };
    const after = applyUpgradeHeroToDetail(before, {
      hero_id: 9,
      level: 4,
      exp: 100,
      previous_level: 3,
      exp_current: 0,
      exp_to_next: 400,
    });
    expect(after.template_name).toBe("刘备");
    expect(after.level).toBe(4);
    expect(after.loyalty).toBe(90);
  });

  it("heroUpgradeDisabledReason covers max level and insufficient exp", () => {
    expect(heroUpgradeDisabledReason({ hero_id: 1, level: HERO_MAX_LEVEL_M1 })).toContain("上限");
    expect(
      heroUpgradeDisabledReason({
        hero_id: 1,
        level: 5,
        exp_current: 10,
        exp_to_next: 100,
      }),
    ).toContain("经验不足");
    expect(
      heroUpgradeDisabledReason({
        hero_id: 1,
        level: 5,
        exp_current: 100,
        exp_to_next: 100,
      }),
    ).toBeNull();
  });

  it("heroUpgradeButtonDisabled when submitting or blocked", () => {
    const ready: HeroDetail = { hero_id: 1, level: 2, exp_current: 200, exp_to_next: 100 };
    expect(heroUpgradeButtonDisabled("idle", ready)).toBe(false);
    expect(heroUpgradeButtonDisabled("submitting", ready)).toBe(true);
    expect(heroUpgradeButtonDisabled("idle", { hero_id: 1, level: 20 })).toBe(true);
  });

  it("formatHeroUpgradeSuccessStatus shows level delta", () => {
    expect(
      formatHeroUpgradeSuccessStatus({ hero_id: 1, level: 3 }, { hero_id: 1, level: 4, exp_current: 0, exp_to_next: 100, exp: 0, previous_level: 3 }),
    ).toBe("升级成功：Lv3→Lv4");
  });

  it("formatHeroUpgradeGatewayErrorFromUnknown maps server messages", () => {
    const maxErr = Object.assign(new Error("x"), {
      code: 10001,
      message: "hero: max level reached",
    });
    expect(formatHeroUpgradeGatewayErrorFromUnknown(maxErr)).toContain("Lv20");
    const expErr = Object.assign(new Error("x"), {
      code: 10001,
      message: "hero: insufficient exp",
    });
    expect(formatHeroUpgradeGatewayErrorFromUnknown(expErr)).toContain("经验不足");
  });

  it("renderHeroDetailUpgradeMarkup includes upgrade action", () => {
    const html = renderHeroDetailUpgradeMarkup("idle", {
      hero_id: 1,
      level: 2,
      exp_current: 200,
      exp_to_next: 100,
    });
    expect(html).toContain('data-action="hero-upgrade"');
    expect(html).not.toContain(" disabled");
    const blocked = renderHeroDetailUpgradeMarkup("idle", { hero_id: 1, level: 20 });
    expect(blocked).toContain(" disabled");
    expect(blocked).toContain("hero-upgrade-disabled-reason");
  });
});
