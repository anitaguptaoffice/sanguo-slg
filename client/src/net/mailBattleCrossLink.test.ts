import { describe, expect, it } from "vitest";
import {
  dailyQuestCrossLinkTags,
  parseBattleReportIdFromMailText,
  parseMailIdFromBattleReportContext,
  resolveBattleReportMailLink,
  resolveMailBattleReportLink,
} from "@/net/mailBattleCrossLink";

describe("mailBattleCrossLink", () => {
  it("parses report_id from mail title and body", () => {
    expect(parseBattleReportIdFromMailText("战报通知", "结算 report_id=42")).toBe(42);
    expect(parseBattleReportIdFromMailText("战报#9", "")).toBe(9);
    expect(parseBattleReportIdFromMailText("系统", "请查看战报：12")).toBe(12);
  });

  it("resolveMailBattleReportLink shows on keyword without id", () => {
    const link = resolveMailBattleReportLink("出征", "本场战斗战报已生成");
    expect(link.show).toBe(true);
    expect(link.reportId).toBeNull();
  });

  it("parses mail_id from battle report context text", () => {
    const summary = { report_id: 1, outcome: 1, created_at_ms: 0 };
    expect(
      parseMailIdFromBattleReportContext(summary, "邮件来源 mail_id=6001", undefined),
    ).toBe(6001);
    expect(parseMailIdFromBattleReportContext(summary, "相关邮件#88", "")).toBe(88);
    expect(
      parseMailIdFromBattleReportContext(summary, "", "source_mail:77"),
    ).toBe(77);
  });

  it("resolveBattleReportMailLink requires parseable mail id", () => {
    const summary = { report_id: 2, outcome: 1, created_at_ms: 0 };
    expect(resolveBattleReportMailLink(summary, "无邮件", "").show).toBe(false);
    expect(
      resolveBattleReportMailLink(summary, "邮件来源 mail_id=5", "").show,
    ).toBe(true);
    expect(resolveBattleReportMailLink(summary, "邮件来源 mail_id=5", "").mailId).toBe(5);
  });

  it("dailyQuestCrossLinkTags for march and build dailies", () => {
    expect(dailyQuestCrossLinkTags({ quest_code: "daily_march_1" })).toEqual([
      { action: "daily-cross-battle-report", label: "战报" },
    ]);
    expect(dailyQuestCrossLinkTags({ quest_cfg_id: 1032 })).toEqual([
      { action: "daily-cross-mail", label: "邮件" },
    ]);
    expect(dailyQuestCrossLinkTags({ quest_code: "daily_train_1" })).toEqual([]);
  });
});
