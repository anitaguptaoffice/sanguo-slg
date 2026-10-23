import { describe, expect, it } from "vitest";
import {
  appendMailWorldCoordStatusHint,
  dailyQuestCrossLinkTags,
  mailPlainTextHasWorldCoord,
  parseBattleReportIdFromMailText,
  parseMailIdFromBattleReportContext,
  resolveBattleReportDailyLinks,
  resolveBattleReportMailLink,
  resolveMailBattleReportLink,
} from "@/net/mailBattleCrossLink";

describe("mailBattleCrossLink", () => {
  it("parses report_id from mail title and body", () => {
    expect(parseBattleReportIdFromMailText("战报通知", "结算 report_id=42")).toBe(42);
    expect(parseBattleReportIdFromMailText("战报#9", "")).toBe(9);
    expect(parseBattleReportIdFromMailText("系统", "请查看战报：12")).toBe(12);
    expect(parseBattleReportIdFromMailText("GM", "详见 #report 55")).toBe(55);
    expect(parseBattleReportIdFromMailText("GM", "#report66")).toBe(66);
    expect(parseBattleReportIdFromMailText("通知", "「战报」88 已归档")).toBe(88);
    expect(parseBattleReportIdFromMailText("全角", "战报１５")).toBe(15);
  });

  it("detects world coords in plain mail text", () => {
    expect(mailPlainTextHasWorldCoord("侦察", "目标格点 (12,34) 请查看")).toBe(true);
    expect(mailPlainTextHasWorldCoord("坐标", "战场坐标（60，60）")).toBe(true);
    expect(mailPlainTextHasWorldCoord("无", "report_id=1")).toBe(false);
    expect(mailPlainTextHasWorldCoord("越界", "(500,1)")).toBe(false);
    expect(appendMailWorldCoordStatusHint("邮件 1/1 封")).toContain("可在世界面板查看");
  });

  it("resolveBattleReportDailyLinks for win/loss with in-progress dailies", () => {
    expect(resolveBattleReportDailyLinks(3, [])).toEqual([]);
    expect(
      resolveBattleReportDailyLinks(1, [
        { quest_cfg_id: 1033, quest_code: "daily_march_1", chain_id: 400, state: 2 },
      ]),
    ).toEqual([{ questCfgId: 1033, label: "相关日常" }]);
    expect(
      resolveBattleReportDailyLinks(2, [
        { quest_cfg_id: 1032, quest_code: "daily_build_1", chain_id: 400, state: 2 },
        { quest_cfg_id: 1033, quest_code: "daily_march_1", chain_id: 400, state: 3 },
      ]),
    ).toEqual([{ questCfgId: 1032, label: "相关日常" }]);
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
