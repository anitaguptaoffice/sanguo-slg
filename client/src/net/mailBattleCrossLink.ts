import type { BattleReportSummary } from "@/net/militaryFormat";
import { formatReportLine } from "@/net/militaryFormat";

const REPORT_ID_RE = /report_id\s*[=:：]\s*(\d+)/i;
const REPORT_HASH_RE = /战报[ \t]*(?:[#＃][ \t]*)?(\d+)/;
const REPORT_COLON_RE = /战报[ \t]*[:：][ \t]*(\d+)/;

const MAIL_ID_RE = /mail_id\s*[=:：]\s*(\d+)/i;
const MAIL_HASH_RE = /邮件[ \t]*(?:[#＃][ \t]*)?(\d+)/;
const MAIL_SOURCE_RE = /(?:source_mail|mail_source)\s*[=:：]\s*(\d+)/i;

export type MailBattleReportLink = {
  show: boolean;
  /** 解析到的战报 ID；仅关键字「战报」时为 null（深链最近一条）。 */
  reportId: number | null;
};

export type BattleReportMailLink = {
  show: boolean;
  mailId: number | null;
};

function joinMailText(title: string, body: string): string {
  return `${title ?? ""}\n${body ?? ""}`;
}

function firstPositiveId(text: string, patterns: RegExp[]): number {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) {
      const id = Number(m[1]);
      if (id > 0) return id;
    }
  }
  return 0;
}

/** 从邮件标题/正文解析战报 report_id（不扩 mail proto）。 */
export function parseBattleReportIdFromMailText(title: string, body: string): number {
  const text = joinMailText(title, body);
  const explicit = firstPositiveId(text, [REPORT_ID_RE]);
  if (explicit > 0) return explicit;
  const hash = firstPositiveId(text, [REPORT_HASH_RE, REPORT_COLON_RE]);
  if (hash > 0) return hash;
  return 0;
}

/** 是否展示邮件详情「查看战报」：含 report_id 或「战报」关键字。 */
export function resolveMailBattleReportLink(title: string, body: string): MailBattleReportLink {
  const text = joinMailText(title, body);
  const reportId = parseBattleReportIdFromMailText(title, body);
  const hasKeyword = text.includes("战报");
  return {
    show: reportId > 0 || hasKeyword,
    reportId: reportId > 0 ? reportId : null,
  };
}

function battleReportSearchBlob(
  summary: BattleReportSummary | undefined,
  detailText: string,
  detailResult?: string,
): string {
  const parts: string[] = [detailText, detailResult ?? ""];
  if (summary) parts.push(formatReportLine(summary));
  return parts.join("\n");
}

/** 从战报详情文案 / summary 行 / detail.result 解析关联 mail_id。 */
export function parseMailIdFromBattleReportContext(
  summary: BattleReportSummary | undefined,
  detailText: string,
  detailResult?: string,
): number {
  const blob = battleReportSearchBlob(summary, detailText, detailResult);
  const explicit = firstPositiveId(blob, [MAIL_ID_RE, MAIL_SOURCE_RE]);
  if (explicit > 0) return explicit;
  return firstPositiveId(blob, [MAIL_HASH_RE]);
}

/** 是否展示战报详情「相关邮件」：上下文含可解析 mail_id 或邮件来源 hint 文案。 */
export function resolveBattleReportMailLink(
  summary: BattleReportSummary | undefined,
  detailText: string,
  detailResult?: string,
): BattleReportMailLink {
  const blob = battleReportSearchBlob(summary, detailText, detailResult);
  const mailId = parseMailIdFromBattleReportContext(summary, detailText, detailResult);
  const hasHint =
    mailId > 0 ||
    /邮件来源|相关邮件|mail_source|source_mail/i.test(blob);
  return {
    show: hasHint && mailId > 0,
    mailId: mailId > 0 ? mailId : null,
  };
}

export type DailyQuestCrossLinkTag = {
  action: "daily-cross-battle-report" | "daily-cross-mail";
  label: string;
};

/** chain 400：daily_march_1 / daily_build_1 只读跨面板标签（与 CLIENT-044 横幅并存）。 */
export function dailyQuestCrossLinkTags(q: {
  quest_code?: string;
  quest_cfg_id?: number;
}): DailyQuestCrossLinkTag[] {
  const code = q.quest_code?.trim();
  const id = q.quest_cfg_id ?? 0;
  if (code === "daily_march_1" || id === 1033) {
    return [{ action: "daily-cross-battle-report", label: "战报" }];
  }
  if (code === "daily_build_1" || id === 1032) {
    return [{ action: "daily-cross-mail", label: "邮件" }];
  }
  return [];
}
