import type { BattleReportOutcomeFilter } from "@/net/militaryFormat";
import type { MailBattleCategoryTab } from "@/net/mailBattleCategory";
import { parseBattleReportIdFromMailText } from "@/net/mailBattleCrossLink";

/** sessionStorage：邮件战报类深链 → 战报 outcome chip 与返回邮件 tab（CLIENT-225）。 */
export const REPORT_OUTCOME_FILTER_BRIDGE_SESSION_KEY = "report-outcome-filter-bridge-v1";

const OUTCOME_FILTER_VALUES: readonly BattleReportOutcomeFilter[] = [
  "all",
  "win",
  "loss",
  "draw",
];

export type MailReturnFromReportBridge = {
  categoryTab: MailBattleCategoryTab;
  inboxFilter: number;
  selectedMailId?: number;
};

export type ReportOutcomeFilterBridgePayload = {
  pendingOutcomeFilter?: BattleReportOutcomeFilter;
  mailReturn?: MailReturnFromReportBridge;
};

export function serializeReportOutcomeFilterBridge(
  payload: ReportOutcomeFilterBridgePayload,
): string {
  return JSON.stringify(payload);
}

export function parseReportOutcomeFilterBridge(
  raw: string | null | undefined,
): ReportOutcomeFilterBridgePayload | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed = JSON.parse(raw) as {
      pendingOutcomeFilter?: unknown;
      mailReturn?: {
        categoryTab?: unknown;
        inboxFilter?: unknown;
        selectedMailId?: unknown;
      };
    };
    const payload: ReportOutcomeFilterBridgePayload = {};
    if (
      typeof parsed.pendingOutcomeFilter === "string" &&
      (OUTCOME_FILTER_VALUES as readonly string[]).includes(parsed.pendingOutcomeFilter)
    ) {
      payload.pendingOutcomeFilter = parsed.pendingOutcomeFilter as BattleReportOutcomeFilter;
    }
    const mr = parsed.mailReturn;
    if (mr && (mr.categoryTab === "battle" || mr.categoryTab === "system")) {
      const inboxFilter = Number(mr.inboxFilter);
      const selectedMailId = Number(mr.selectedMailId);
      payload.mailReturn = {
        categoryTab: mr.categoryTab,
        inboxFilter: Number.isFinite(inboxFilter) ? Math.trunc(inboxFilter) : 0,
        selectedMailId:
          Number.isFinite(selectedMailId) && selectedMailId > 0
            ? Math.trunc(selectedMailId)
            : undefined,
      };
    }
    if (!payload.pendingOutcomeFilter && !payload.mailReturn) return null;
    return payload;
  } catch {
    return null;
  }
}

export function readReportOutcomeFilterBridge(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): ReportOutcomeFilterBridgePayload | null {
  try {
    return parseReportOutcomeFilterBridge(
      storage?.getItem(REPORT_OUTCOME_FILTER_BRIDGE_SESSION_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

function writeReportOutcomeFilterBridge(
  payload: ReportOutcomeFilterBridgePayload | null,
  storage: Pick<Storage, "setItem" | "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    if (!payload || (!payload.pendingOutcomeFilter && !payload.mailReturn)) {
      storage?.removeItem(REPORT_OUTCOME_FILTER_BRIDGE_SESSION_KEY);
      return;
    }
    storage?.setItem(REPORT_OUTCOME_FILTER_BRIDGE_SESSION_KEY, serializeReportOutcomeFilterBridge(payload));
  } catch {
    /* quota / private mode */
  }
}

/** 从邮件标题/正文只读推断 outcome chip（无字段时不写 pending）。 */
export function inferBattleReportOutcomeFilterFromMail(
  title: string,
  body: string,
): BattleReportOutcomeFilter | null {
  const text = `${title ?? ""}\n${body ?? ""}`;
  if (/攻胜|攻方获胜|attacker_win/i.test(text)) return "win";
  if (/守胜|守方获胜|defender_win/i.test(text)) return "loss";
  if (/战败|失败|失利/i.test(text)) return "loss";
  if (/胜利|获胜/.test(text) && !/失败|战败/.test(text)) return "win";
  if (/平局|和局|draw/i.test(text)) return "draw";
  if (parseBattleReportIdFromMailText(title, body) > 0) {
    if (/胜/.test(text) && !/败|负/.test(text)) return "win";
    if (/败|负/.test(text)) return "loss";
  }
  return null;
}

export function stageReportOutcomeFilterBridgeFromMail(input: {
  title: string;
  body: string;
  categoryTab: MailBattleCategoryTab;
  inboxFilter: number;
  selectedMailId?: number;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
}): void {
  const storage = input.storage ?? (typeof sessionStorage !== "undefined" ? sessionStorage : null);
  const existing = readReportOutcomeFilterBridge(storage) ?? {};
  const pending = inferBattleReportOutcomeFilterFromMail(input.title, input.body);
  const next: ReportOutcomeFilterBridgePayload = {
    ...existing,
    mailReturn: {
      categoryTab: input.categoryTab,
      inboxFilter: input.inboxFilter,
      selectedMailId: input.selectedMailId,
    },
  };
  if (pending) next.pendingOutcomeFilter = pending;
  writeReportOutcomeFilterBridge(next, storage);
}

export function consumePendingOutcomeFilterBridge(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): BattleReportOutcomeFilter | null {
  const payload = readReportOutcomeFilterBridge(storage);
  if (!payload?.pendingOutcomeFilter) return null;
  const filter = payload.pendingOutcomeFilter;
  writeReportOutcomeFilterBridge({ ...payload, pendingOutcomeFilter: undefined }, storage);
  return filter;
}

export function takeMailReturnFromReportBridge(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): MailReturnFromReportBridge | null {
  const payload = readReportOutcomeFilterBridge(storage);
  if (!payload?.mailReturn) return null;
  const mailReturn = payload.mailReturn;
  writeReportOutcomeFilterBridge({ ...payload, mailReturn: undefined }, storage);
  return mailReturn;
}
