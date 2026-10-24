import { describe, expect, it } from "vitest";
import {
  applyMailClaimResult,
  syncMailInboxSnapshotAfterClaim,
  syncMailRowAfterClaim,
  formatHeroDetail,
  formatHeroLine,
  syncHeroSummaryFromDetail,
  formatMailLine,
  formatRecruitTemplateLine,
  heroListLines,
  InvalidHeroDetailRequestError,
  countMailUnreadAndUnclaimed,
  countMailsWithUnclaimedAttachments,
  mailIsUnreadForInboxCount,
  formatMailClaimGrantedSummary,
  mailCanClaimAttachments,
  mailHasUnclaimedAttachments,
  mailEmptyInboxMessage,
  mailListLines,
  mailListSummary,
  MAIL_INBOX_FILTER_UNREAD,
  parseGetHeroDetailResponse,
  formatRecruitDeductSummary,
  formatRecruitSuccessStatus,
  heroOwnedTemplateIds,
  isRecruitTemplateOwned,
  mergeRecruitTemplateOwnership,
  parseRecruitTemplates,
  recruitTemplateListLines,
  compareHeroDetailToTemplate,
  filterHeroCultivationBagItemIds,
  formatHeroAttributeDelta,
  renderHeroDetailMarkup,
  requireHeroIdForDetail,
  resolveHeroDetailUpgradeProgress,
  upsertMailRow,
} from "@/net/heroMailState";

describe("heroMailState", () => {
  it("shows empty placeholders", () => {
    expect(heroListLines([])).toEqual(["（尚无将领，可尝试招募）"]);
    expect(mailListLines([])[0]).toContain("暂无邮件");
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

  it("mailListSummary and claim helpers", () => {
    expect(mailEmptyInboxMessage(MAIL_INBOX_FILTER_UNREAD)).toContain("无未读");
    expect(mailListSummary({ mail_id: 1, body: "一二三四五六七八九十" })).toContain("一二三四");
    expect(
      mailCanClaimAttachments({
        mail_id: 1,
        status: 0,
        attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
      }),
    ).toBe(true);
    expect(mailCanClaimAttachments({ mail_id: 1, status: 2, attachments: { items: [{ item_cfg_id: 1 }] } })).toBe(
      false,
    );
  });

  it("countMailUnreadAndUnclaimed from inbox snapshot", () => {
    expect(
      countMailUnreadAndUnclaimed([
        { mail_id: 1, status: 0, attachments: { items: [{ item_cfg_id: 1, quantity: 1 }] } },
        { mail_id: 2, status: 2, read_at_ms: 100, attachments: { items: [{ item_cfg_id: 2 }] } },
        { mail_id: 3, status: 1, attachments: { items: [{ item_cfg_id: 3 }] } },
      ]),
    ).toEqual({ unread: 1, unclaimed: 2 });
    expect(mailIsUnreadForInboxCount({ mail_id: 9, status: 0, read_at_ms: 1 })).toBe(false);
    expect(mailIsUnreadForInboxCount({ mail_id: 9, status: 0 })).toBe(true);
  });

  it("mailHasUnclaimedAttachments prefers API flag and counts rows", () => {
    expect(
      mailHasUnclaimedAttachments({
        mail_id: 1,
        status: 2,
        has_unclaimed_attachments: true,
      }),
    ).toBe(true);
    expect(
      mailHasUnclaimedAttachments({
        mail_id: 2,
        status: 1,
        has_unclaimed_attachments: false,
        attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
      }),
    ).toBe(false);
    expect(
      mailHasUnclaimedAttachments({
        mail_id: 3,
        status: 1,
        attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
      }),
    ).toBe(true);
    const mails = [
      { mail_id: 1, status: 0, attachments: { items: [{ item_cfg_id: 1, quantity: 1 }] } },
      { mail_id: 2, status: 2 },
    ];
    expect(countMailsWithUnclaimedAttachments(mails)).toBe(1);
    expect(
      countMailsWithUnclaimedAttachments(
        mails.map((m) => (m.mail_id === 1 ? { ...m, status: 2, has_unclaimed_attachments: false } : m)),
      ),
    ).toBe(0);
  });

  it("formatMailClaimGrantedSummary lists item labels and resources", () => {
    const text = formatMailClaimGrantedSummary({
      items: [{ item_cfg_id: 2001, quantity: 3 }],
      resources: { gold: 50 },
    });
    expect(text).toContain("谷袋");
    expect(text).toContain("×3");
    expect(text).toContain("币");
  });

  it("syncMailRowAfterClaim marks row claimed and updates inbox snapshot", () => {
    const mails = [
      {
        mail_id: 9,
        status: 0,
        attachments: { items: [{ item_cfg_id: 2001, quantity: 1 }] },
      },
    ];
    const next = syncMailRowAfterClaim(mails, 9, {
      mail: { mail_id: 9, status: 2, claimed_at_ms: 99 },
    });
    expect(next[0].status).toBe(2);
    expect(next[0].has_unclaimed_attachments).toBe(false);
    expect(mailHasUnclaimedAttachments(next[0])).toBe(false);
    const snap = syncMailInboxSnapshotAfterClaim(mails, 9, next[0]);
    expect(countMailUnreadAndUnclaimed(snap).unclaimed).toBe(0);
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
    expect(patch.mails[0].has_unclaimed_attachments).toBe(false);
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

  it("formatRecruitSuccessStatus includes template name and deduct summary", () => {
    const msg = formatRecruitSuccessStatus(
      { hero_id: 42, template_cfg_id: 1001, level: 1, loyalty: 100 },
      {
        template_cfg_id: 1001,
        template_name: "玄德府君",
        recruit_cost: { food: 5000 },
        recruit_item: { item_cfg_id: 2004, quantity: 1 },
      },
    );
    expect(msg).toContain("玄德府君");
    expect(msg).toContain("#42");
    expect(msg).toContain("贤士名册");
    expect(msg).toContain("粮");
  });

  it("recruitTemplateListLines handles empty list", () => {
    expect(recruitTemplateListLines([])).toEqual(["（无可招募模板）"]);
    const line = formatRecruitTemplateLine({
      template_cfg_id: 1001,
      template_name: "玄德府君",
      rarity: 5,
      recruit_cost: { food: 5000 },
      recruit_item: { item_cfg_id: 2004, quantity: 1 },
      already_owned: true,
    });
    expect(line).toContain("1001");
    expect(line).toContain("贤士名册");
    expect(line).toContain("粮");
    expect(line).toContain("已招募");
  });

  it("isRecruitTemplateOwned merges API flag and hero roster", () => {
    const owned = heroOwnedTemplateIds([{ hero_id: 1, template_cfg_id: 1002 }]);
    expect(isRecruitTemplateOwned({ template_cfg_id: 1001 }, owned)).toBe(false);
    expect(isRecruitTemplateOwned({ template_cfg_id: 1002 }, owned)).toBe(true);
    expect(isRecruitTemplateOwned({ template_cfg_id: 1003, already_owned: true }, owned)).toBe(true);
    const merged = mergeRecruitTemplateOwnership(
      [{ template_cfg_id: 1001 }, { template_cfg_id: 1002 }],
      [{ template_cfg_id: 1002 }],
    );
    expect(merged[0].already_owned).toBe(false);
    expect(merged[1].already_owned).toBe(true);
  });

  it("formatRecruitDeductSummary matches recruit success deduct line", () => {
    const tpl = {
      template_cfg_id: 1001,
      recruit_cost: { food: 5000, wood: 200 },
      recruit_item: { item_cfg_id: 2004, quantity: 2 },
    };
    const summary = formatRecruitDeductSummary(tpl);
    expect(summary).toContain("粮");
    expect(summary).toContain("木");
    expect(summary).toContain("贤士名册");
    expect(summary).toContain("×2");
    const status = formatRecruitSuccessStatus({ hero_id: 1, template_cfg_id: 1001 }, tpl);
    expect(status).toContain(summary);
  });

  it("renderHeroDetailMarkup shows name level and attribute bars", () => {
    const html = renderHeroDetailMarkup({
      hero_id: 3,
      template_name: "玄德",
      template_cfg_id: 1001,
      level: 5,
      rarity: 5,
      loyalty: 80,
      loyalty_min: 0,
      loyalty_max: 100,
      attributes: { force: 60, intel: 70, politics: 50, command: 90 },
    });
    expect(html).toContain("hero-detail-name");
    expect(html).toContain("玄德");
    expect(html).toContain("Lv5");
    expect(html).toContain("hero-attr-table");
    expect(html).toContain('style="width:90%"');
    expect(html).toContain("统率");
    expect(html).toContain("hero-growth-compare-strip");
    expect(html).toContain("等级 Lv5→Lv6");
    expect(html).toContain("hero-upgrade-progress");
    expect(html).toContain("hero-upgrade-progress-bar");
    expect(html).toContain("hero-upgrade-progress-line");
    expect(html).toContain("hero-goto-recruit");
    expect(html).toContain("hero-attr-delta-pos");
    expect(html).toContain("+12");
  });

  it("compareHeroDetailToTemplate computes four-attribute deltas", () => {
    const { rows, hasBaseline } = compareHeroDetailToTemplate(
      {
        hero_id: 1,
        template_cfg_id: 1001,
        attributes: { force: 75, intel: 75, politics: 90, command: 80 },
      },
      { template_cfg_id: 1001 },
    );
    expect(hasBaseline).toBe(true);
    expect(rows.find((r) => r.key === "force")?.delta).toBe(3);
    expect(rows.find((r) => r.key === "politics")?.delta).toBe(2);
    expect(formatHeroAttributeDelta(-2)).toBe("-2");
    expect(formatHeroAttributeDelta(0)).toBe("0");
  });

  it("resolveHeroDetailUpgradeProgress prefers exp then loyalty bars", () => {
    const withExp = resolveHeroDetailUpgradeProgress({
      hero_id: 1,
      level: 3,
      exp_current: 40,
      exp_to_next: 100,
      loyalty: 50,
      loyalty_min: 0,
      loyalty_max: 100,
    });
    expect(withExp.mode).toBe("bars");
    if (withExp.mode === "bars") {
      expect(withExp.bars.map((b) => b.kind)).toEqual(["level_exp", "loyalty"]);
    }
    const fallback = resolveHeroDetailUpgradeProgress({ hero_id: 1, level: 2, loyalty: 88 });
    expect(fallback).toEqual({ mode: "fallback", summary: "Lv2 · 忠诚 88" });
  });

  it("syncHeroSummaryFromDetail updates list row level and loyalty", () => {
    const heroes = [{ hero_id: 3, template_cfg_id: 1001, level: 2, loyalty: 70 }];
    const next = syncHeroSummaryFromDetail(heroes, {
      hero_id: 3,
      level: 3,
      loyalty: 85,
      loyalty_min: 0,
      loyalty_max: 100,
    });
    expect(formatHeroLine(next[0])).toContain("Lv3");
    expect(formatHeroLine(next[0])).toContain("忠诚 85");
  });

  it("filterHeroCultivationBagItemIds keeps known consumables with qty", () => {
    expect(filterHeroCultivationBagItemIds([{ item_cfg_id: 2017, quantity: 2 }, { item_cfg_id: 2001, quantity: 5 }])).toEqual([
      2017,
    ]);
  });
});
