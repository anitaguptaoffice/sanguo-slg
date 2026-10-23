import type { BattleReportSummary } from "@/net/militaryFormat";
import { formatReportLine } from "@/net/militaryFormat";
import { DAILY_QUEST_CHAIN_ID } from "@/net/dailyQuestState";

const REPORT_ID_RE = /report_id\s*[=:：]\s*(\d+)/i;
const REPORT_HASH_RE = /战报[ \t]*(?:[#＃][ \t]*)?(\d+)/;
const REPORT_COLON_RE = /战报[ \t]*[:：][ \t]*(\d+)/;
const REPORT_HASH_TAG_RE = /#\s*report\s*(\d+)/i;
const REPORT_FW_BRACKET_RE = /「战报」\s*(\d+)/;
const REPORT_FW_DIGITS_RE = /战报[ \t]*([０-９]+)/;

const MAIL_COORD_PAREN_RE = /[（(]\s*(\d{1,3})\s*[,，]\s*(\d{1,3})\s*[)）]/;
const MAIL_COORD_LABEL_RE = /坐标\s*[（(]?\s*(\d{1,3})\s*[,，]\s*(\d{1,3})\s*[)）]?/;

export const MAIL_WORLD_COORD_STATUS_HINT = "可在世界面板查看";

export const DAILY_MARCH_QUEST_CFG_ID = 1033;
export const DAILY_BUILD_QUEST_CFG_ID = 1032;

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

function fullwidthDigitsToAscii(raw: string): string {
  return raw.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

function parseIdFromFullwidthDigitMatch(m: RegExpMatchArray | null): number {
  if (!m?.[1]) return 0;
  const id = Number(fullwidthDigitsToAscii(m[1]));
  return id > 0 ? id : 0;
}

function isValidWorldGridCoord(x: number, y: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    x <= 499 &&
    y >= 0 &&
    y <= 499
  );
}

function parseCoordPairFromMatch(m: RegExpMatchArray | null): { x: number; y: number } | null {
  if (!m?.[1] || !m[2]) return null;
  const x = Number(m[1]);
  const y = Number(m[2]);
  if (!isValidWorldGridCoord(x, y)) return null;
  return { x, y };
}

/** 从邮件标题/正文解析战报 report_id（不扩 mail proto）。 */
export function parseBattleReportIdFromMailText(title: string, body: string): number {
  const text = joinMailText(title, body);
  const explicit = firstPositiveId(text, [REPORT_ID_RE, REPORT_HASH_TAG_RE]);
  if (explicit > 0) return explicit;
  const bracket = firstPositiveId(text, [REPORT_FW_BRACKET_RE]);
  if (bracket > 0) return bracket;
  const fw = parseIdFromFullwidthDigitMatch(text.match(REPORT_FW_DIGITS_RE));
  if (fw > 0) return fw;
  const hash = firstPositiveId(text, [REPORT_HASH_RE, REPORT_COLON_RE]);
  if (hash > 0) return hash;
  return 0;
}

/** GM send-mail 等纯文本是否含可读世界格点坐标（只读提示，不扩 mail proto）。 */
export function mailPlainTextHasWorldCoord(title: string, body: string): boolean {
  const text = joinMailText(title, body);
  for (const re of [MAIL_COORD_LABEL_RE, MAIL_COORD_PAREN_RE]) {
    const m = text.match(re);
    if (parseCoordPairFromMatch(m)) return true;
  }
  return false;
}

export function appendMailWorldCoordStatusHint(baseStatus: string): string {
  const trimmed = baseStatus.trim();
  if (!trimmed) return MAIL_WORLD_COORD_STATUS_HINT;
  if (trimmed.includes(MAIL_WORLD_COORD_STATUS_HINT)) return trimmed;
  return `${trimmed} · ${MAIL_WORLD_COORD_STATUS_HINT}`;
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
export type BattleReportDailyLink = {
  questCfgId: number;
  label: string;
};

export function isBattleOutcomeWinOrLoss(outcome: number | undefined): boolean {
  const o = outcome ?? 0;
  return o === 1 || o === 2;
}

export function isDailyQuestChainInProgress(q: {
  chain_id?: number;
  quest_code?: string;
  quest_cfg_id?: number;
  state?: number;
}): boolean {
  const chain = q.chain_id ?? DAILY_QUEST_CHAIN_ID;
  if (chain !== DAILY_QUEST_CHAIN_ID) return false;
  if ((q.state ?? 0) !== 2) return false;
  const code = q.quest_code?.trim();
  const id = q.quest_cfg_id ?? 0;
  return (
    code === "daily_march_1" ||
    id === DAILY_MARCH_QUEST_CFG_ID ||
    code === "daily_build_1" ||
    id === DAILY_BUILD_QUEST_CFG_ID
  );
}

/** 战报详情「相关日常」：胜/负且 chain 400 对应日课进行中。 */
export function resolveBattleReportDailyLinks(
  outcome: number | undefined,
  rows: {
    chain_id?: number;
    quest_code?: string;
    quest_cfg_id?: number;
    state?: number;
  }[],
): BattleReportDailyLink[] {
  if (!isBattleOutcomeWinOrLoss(outcome)) return [];
  const links: BattleReportDailyLink[] = [];
  for (const q of rows) {
    if (!isDailyQuestChainInProgress(q)) continue;
    const cfgId = q.quest_cfg_id ?? 0;
    if (cfgId <= 0) continue;
    links.push({ questCfgId: cfgId, label: "相关日常" });
  }
  return links;
}

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
