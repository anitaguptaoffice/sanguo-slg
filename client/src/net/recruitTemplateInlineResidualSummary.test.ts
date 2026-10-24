import { describe, expect, it } from "vitest";
import { formatRecruitTemplateInlineResidualSummary } from "@/net/recruitTemplateInlineResidualSummary";

describe("formatRecruitTemplateInlineResidualSummary (CLIENT-257)", () => {
  it("includes template id and wallet balances for cost currencies", () => {
    const line = formatRecruitTemplateInlineResidualSummary(
      { gold: 5, food: 120 },
      { template_cfg_id: 1001, recruit_cost: { gold: 10, food: 50 } },
      [],
    );
    expect(line).toContain("模板#1001");
    expect(line).toContain("币余5");
    expect(line).toContain("粮余120");
  });

  it("returns null without template id", () => {
    expect(formatRecruitTemplateInlineResidualSummary({ gold: 1 }, undefined, [])).toBeNull();
    expect(
      formatRecruitTemplateInlineResidualSummary({ gold: 1 }, { template_cfg_id: 0 }, []),
    ).toBeNull();
  });
});
