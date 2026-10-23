import { describe, expect, it } from "vitest";
import {
  applyMailClaimResult,
  formatHeroLine,
  formatMailLine,
  formatRecruitTemplateLine,
  heroListLines,
  mailListLines,
  parseRecruitTemplates,
  recruitTemplateListLines,
  upsertMailRow,
} from "@/net/heroMailState";

describe("heroMailState", () => {
  it("shows empty placeholders", () => {
    expect(heroListLines([])).toEqual(["（尚无将领，可尝试招募）"]);
    expect(mailListLines([])).toEqual(["（空）"]);
  });

  it("formats hero and mail lines", () => {
    expect(formatHeroLine({ hero_id: 9, template_cfg_id: 1001, level: 3, loyalty: 88 })).toContain("刘备");
    expect(formatMailLine({ mail_id: 1, title: "奖", status: 0 })).toContain("未读");
  });

  it("applyMailClaimResult merges wallet and marks mail claimed", () => {
    const mails = [{ mail_id: 42, title: "t", status: 0 }];
    const patch = applyMailClaimResult(
      mails,
      42,
      {
        mail: { mail_id: 42, status: 2, claimed_at_ms: 1 },
        granted: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
        wallet_after: { food: 999 },
      },
      { bag: [], wallet: { food: 100 } },
    );
    expect(patch.mails[0].status).toBe(2);
    expect(patch.wallet.food).toBe(999);
    expect(patch.bag).toEqual([{ item_cfg_id: 2001, quantity: 1 }]);
  });

  it("upsertMailRow replaces existing row", () => {
    const next = upsertMailRow([{ mail_id: 1, status: 0 }], { mail_id: 1, status: 1 });
    expect(next).toEqual([{ mail_id: 1, status: 1 }]);
  });

  it("parseRecruitTemplates filters invalid rows", () => {
    const { templates, totalCount } = parseRecruitTemplates({
      templates: [
        { template_cfg_id: 1001, template_name: "玄德", rarity: 5 },
        { template_cfg_id: 0 },
      ],
      total_count: 2,
    });
    expect(templates).toHaveLength(1);
    expect(templates[0].template_cfg_id).toBe(1001);
    expect(totalCount).toBe(2);
  });

  it("recruitTemplateListLines handles empty list", () => {
    expect(recruitTemplateListLines([])).toEqual(["（无可招募模板）"]);
    const line = formatRecruitTemplateLine({
      template_cfg_id: 1001,
      template_name: "玄德府君",
      rarity: 5,
      recruit_cost: { food: 5000 },
      recruit_item: { item_cfg_id: 2004, quantity: 1 },
    });
    expect(line).toContain("1001");
    expect(line).toContain("贤士名册");
    expect(line).toContain("粮");
  });
});
