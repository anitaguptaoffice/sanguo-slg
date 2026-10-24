import { describe, expect, it } from "vitest";
import {
  formatHeroAttributesAbbrev,
  formatHeroListRowPrimary,
  formatHeroListRowSecondary,
  HERO_LIST_ROW_SECONDARY_DETAIL_HINT,
  resolveHeroListRowSource,
} from "@/net/heroListRowFormat";

describe("heroListRowFormat", () => {
  it("formatHeroListRowPrimary shows template name level and loyalty", () => {
    expect(
      formatHeroListRowPrimary({
        hero_id: 9,
        template_cfg_id: 1001,
        level: 3,
        loyalty: 88,
      }),
    ).toBe("刘备 · Lv3 · 忠诚 88");
    expect(
      formatHeroListRowPrimary({
        hero_id: 1,
        template_name: "云长",
        template_cfg_id: 1002,
        level: 7,
        loyalty: 95,
      }),
    ).toBe("云长 · Lv7 · 忠诚 95");
  });

  it("formatHeroListRowSecondary prefers four-stat abbrev when attributes exist", () => {
    const attrs = { force: 72, intel: 75, politics: 88, command: 78 };
    expect(formatHeroAttributesAbbrev(attrs)).toBe("武72 智75 政88 统78");
    expect(
      formatHeroListRowSecondary({
        hero_id: 1,
        template_cfg_id: 1001,
        attributes: attrs,
      }),
    ).toBe("武72 智75 政88 统78");
    expect(
      formatHeroListRowSecondary(
        { hero_id: 1, template_cfg_id: 1001 },
        { detailAttributes: attrs },
      ),
    ).toBe("武72 智75 政88 统78");
  });

  it("formatHeroListRowSecondary falls back to cultivation hint without stats", () => {
    expect(formatHeroListRowSecondary({ hero_id: 1, template_cfg_id: 1001 })).toBe(
      HERO_LIST_ROW_SECONDARY_DETAIL_HINT,
    );
    expect(
      formatHeroListRowSecondary({ hero_id: 1, template_cfg_id: 1001 }, { detailAttributes: null }),
    ).toBe(HERO_LIST_ROW_SECONDARY_DETAIL_HINT);
  });

  it("resolveHeroListRowSource merges detail only for matching hero_id", () => {
    const hero = { hero_id: 2, template_cfg_id: 1001, level: 1, loyalty: 50 };
    const detail = {
      hero_id: 2,
      template_name: "玄德",
      level: 4,
      loyalty: 60,
      attributes: { force: 10, intel: 11, politics: 12, command: 13 },
    };
    expect(resolveHeroListRowSource(hero, detail).template_name).toBe("玄德");
    expect(resolveHeroListRowSource(hero, { ...detail, hero_id: 99 })).toEqual(hero);
  });
});
