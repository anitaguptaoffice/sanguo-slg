import { describe, expect, it } from "vitest";
import { formatRecruitFormInlineHint } from "@/net/recruitFormInlineHint";

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
