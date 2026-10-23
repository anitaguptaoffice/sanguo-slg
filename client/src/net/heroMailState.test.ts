import { describe, expect, it } from "vitest";
import {
  applyMailClaimResult,
  formatHeroDetail,
  formatHeroLine,
  formatMailLine,
  formatRecruitTemplateLine,
  heroListLines,
  InvalidHeroDetailRequestError,
  mailListLines,
  parseGetHeroDetailResponse,
  parseRecruitTemplates,
  recruitTemplateListLines,
  requireHeroIdForDetail,
  upsertMailRow,
} from "@/net/heroMailState";

describe("heroMailState", () => {
  it("shows empty placeholders", () => {
    expect(heroListLines([])).toEqual(["（尚无将领，可尝试招募）"]);
    expect(mailListLines([])).toEqual(["（空）"]);
  });

  it("formats hero and mail lines", () => {
    expect(formatHeroLine({ hero_id: 9, template_cfg_id: 1001, level: 3, loyalty: 88 })).toContain("刘备");
    expect(formatHeroLine({ hero_id: 9, template_cfg_id: 1001, level: 3, loyalty: 88 })).toContain("Lv3");
    expect(formatHeroLine({ hero_id: 9, template_cfg_id: 1001, level: 3, loyalty: 88 })).toContain("忠诚 88");
    expect(formatMailLine({ mail_id: 1, title: "奖", status: 0 })).toContain("未读");
  });

  it("parseGetHeroDetailResponse maps gateway fields", () => {
    const detail = parseGetHeroDetailResponse({
      hero_id: 42,
      template_cfg_id: 1002,
      template_name: "云长",
      template_code: "guan_yu",
      rarity: 5,
      level: 7,
      loyalty: 90,
      loyalty_min: 0,
      loyalty_max: 100,
      attributes: { force: 95, intel: 75, politics: 60, command: 88 },
    });
    expect(detail.template_name).toBe("云长");
    expect(detail.rarity).toBe(5);
    expect(detail.attributes?.force).toBe(95);
    const text = formatHeroDetail(detail);
    expect(text).toContain("云长");
    expect(text).toContain("武95");
    expect(text).toContain("区间 0~100");
    expect(text).toContain("UseConsumable");
  });

  it("requireHeroIdForDetail rejects empty hero_id", () => {
    expect(() => requireHeroIdForDetail(0)).toThrow(InvalidHeroDetailRequestError);
    expect(() => requireHeroIdForDetail(-1)).toThrow(/hero_id/);
    expect(() => requireHeroIdForDetail(Number.NaN)).toThrow(InvalidHeroDetailRequestError);
    expect(() => requireHeroIdForDetail(1)).not.toThrow();
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
