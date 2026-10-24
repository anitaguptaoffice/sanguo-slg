import { describe, expect, it } from "vitest";
import { formatRecruitTemplateInlineResidualDeepSummary } from "@/net/recruitTemplateInlineResidualDeepSummary";

describe("formatRecruitTemplateInlineResidualDeepSummary (CLIENT-273)", () => {
  it("deepens template id and wallet balances with need/have flags", () => {
    const line = formatRecruitTemplateInlineResidualDeepSummary(
      { gold: 5, food: 120 },
      { template_cfg_id: 1001, recruit_cost: { gold: 10, food: 50 } },
      [],
    );
    expect(line).toContain("摘要加深");
    expect(line).toContain("模板#1001");
    expect(line).toContain("币余5/需10(缺)");
    expect(line).toContain("粮余120/需50(足)");
    expect(line).toContain("残余 模板#1001");
  });

  it("returns null without template id", () => {
    expect(formatRecruitTemplateInlineResidualDeepSummary({ gold: 1 }, undefined, [])).toBeNull();
    expect(
      formatRecruitTemplateInlineResidualDeepSummary({ gold: 1 }, { template_cfg_id: 0 }, []),
    ).toBeNull();
  });
});
