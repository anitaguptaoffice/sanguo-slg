import { describe, expect, it } from "vitest";
import { formatRecruitTemplateInlineResidualDeepestDeepestDeeperSummary } from "@/net/recruitTemplateInlineResidualDeepestDeepestDeeperSummary";

describe("formatRecruitTemplateInlineResidualDeepestDeepestDeeperSummary (CLIENT-337)", () => {
  it("deepens template id and wallet balances with need/have flags", () => {
    const line = formatRecruitTemplateInlineResidualDeepestDeepestDeeperSummary(
      { gold: 5, food: 120 },
      { template_cfg_id: 1001, recruit_cost: { gold: 10, food: 50 } },
      [],
    );
    expect(line).toContain("摘要巩固再加深三层");
    expect(line).toContain("模板#1001");
    expect(line).toContain("币余5/需10(缺)");
    expect(line).toContain("粮余120/需50(足)");
    expect(line).toContain("加深 摘要巩固再加深二层");
  });

  it("returns null without template id", () => {
    expect(
      formatRecruitTemplateInlineResidualDeepestDeepestDeeperSummary({ gold: 1 }, undefined, []),
    ).toBeNull();
    expect(
      formatRecruitTemplateInlineResidualDeepestDeepestDeeperSummary(
        { gold: 1 },
        { template_cfg_id: 0 },
        [],
      ),
    ).toBeNull();
  });
});
