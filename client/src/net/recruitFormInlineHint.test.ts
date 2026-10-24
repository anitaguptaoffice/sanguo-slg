import { describe, expect, it } from "vitest";
import {
  buildRecruitItemGapBagDeepLink,
  formatRecruitFormInlineHint,
  parseRecruitItemGapBagDeepLink,
  RECRUIT_ITEM_GAP_BAG_QUERY_KEY,
  serializeRecruitItemGapBagDeepLink,
} from "@/net/recruitFormInlineHint";
import { parseHeroBagDeepLinkQuery } from "@/net/heroDetailBagDeepLink";

describe("formatRecruitFormInlineHint (CLIENT-201)", () => {
  it("warns when no template selected", () => {
    const hint = formatRecruitFormInlineHint(undefined, { food: 100 }, []);
    expect(hint.hasWarn).toBe(true);
    expect(hint.canSubmit).toBe(false);
    expect(hint.text).toContain("请先");
    expect(hint.itemGapItemCfgId).toBeNull();
  });

  it("allows submit when wallet and bag cover recruit cost", () => {
    const hint = formatRecruitFormInlineHint(
      {
        template_cfg_id: 1001,
        template_name: "玄德",
        recruit_cost: { food: 50 },
        recruit_item: { item_cfg_id: 2004, quantity: 1 },
      },
      { food: 100 },
      [{ item_cfg_id: 2004, quantity: 2 }],
    );
    expect(hint.hasWarn).toBe(false);
    expect(hint.canSubmit).toBe(true);
    expect(hint.text).toContain("校验");
    expect(hint.text).toContain("玄德");
    expect(hint.itemGapItemCfgId).toBeNull();
  });

  it("warns and exposes item gap cfg id for recruit_item shortfall", () => {
    const hint = formatRecruitFormInlineHint(
      {
        template_cfg_id: 1001,
        template_name: "玄德",
        recruit_cost: { food: 10 },
        recruit_item: { item_cfg_id: 2004, quantity: 2 },
      },
      { food: 100 },
      [{ item_cfg_id: 2004, quantity: 0 }],
    );
    expect(hint.hasWarn).toBe(true);
    expect(hint.canSubmit).toBe(false);
    expect(hint.itemGapItemCfgId).toBe(2004);
    expect(hint.text).toContain("不足");
  });

  it("disables submit for resource deficit without item gap deep link", () => {
    const hint = formatRecruitFormInlineHint(
      {
        template_cfg_id: 1002,
        recruit_cost: { gold: 99 },
      },
      { gold: 1 },
      [],
    );
    expect(hint.hasWarn).toBe(true);
    expect(hint.canSubmit).toBe(false);
    expect(hint.itemGapItemCfgId).toBeNull();
  });
});

describe("recruit item gap bag deep link (CLIENT-201)", () => {
  it("round-trips recruitItemGap query with highlightItemId", () => {
    const serialized = serializeRecruitItemGapBagDeepLink(2017);
    expect(serialized).toContain(`${RECRUIT_ITEM_GAP_BAG_QUERY_KEY}=1`);
    expect(serialized).toContain("highlightItemId=2017");
    const parsed = parseRecruitItemGapBagDeepLink(serialized);
    expect(parsed?.itemCfgId).toBe(2017);
    expect(parsed?.link.recruitItemGap).toBe(true);
    expect(parseHeroBagDeepLinkQuery(serialized)?.highlightItemId).toBe(2017);
  });

  it("parseRecruitItemGapBagDeepLink rejects hero deep link without recruitItemGap flag", () => {
    const link = buildRecruitItemGapBagDeepLink(2017);
    const heroOnly = `highlightItemId=2017&bagCategory=cultivation`;
    expect(parseRecruitItemGapBagDeepLink(heroOnly)).toBeNull();
    expect(link.recruitItemGap).toBe(true);
  });
});
