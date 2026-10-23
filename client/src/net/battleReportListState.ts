import type {
  BattleReportOutcomeFilter,
  BattleReportTimeWindowFilter,
} from "@/net/militaryFormat";

/** sessionStorage：战报列表 outcome 筛选（CLIENT-109 / CLIENT-049，仅客户端）。 */
export const BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY = "battle-report-outcome-filter-v1";

/** CLIENT-049 旧键；读取时迁移至 {@link BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY}。 */
export const LEGACY_BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY =
  "rxsg.client.battleReport.outcomeFilter";

/** sessionStorage：战报列表时间窗筛选（CLIENT-065，与 outcome 键分离）。 */
export const BATTLE_REPORT_TIME_WINDOW_FILTER_SESSION_KEY =
  "rxsg.client.battleReport.timeWindowFilter";

export const BATTLE_REPORT_LOAD_MORE_LABEL = "加载更多";

const OUTCOME_FILTER_VALUES: readonly BattleReportOutcomeFilter[] = [
  "all",
  "win",
  "loss",
  "draw",
];

export function parseBattleReportOutcomeFilterSessionValue(
  raw: string | null | undefined,
): BattleReportOutcomeFilter | null {
  if (raw == null || raw === "") return null;
  if ((OUTCOME_FILTER_VALUES as readonly string[]).includes(raw)) {
    return raw as BattleReportOutcomeFilter;
  }
  return null;
}

export function readBattleReportOutcomeFilterSession(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null =
    typeof sessionStorage !== "undefined" ? sessionStorage : null,
): BattleReportOutcomeFilter | null {
  try {
    const fromCurrent = parseBattleReportOutcomeFilterSessionValue(
      storage?.getItem(BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY) ?? null,
    );
    if (fromCurrent) return fromCurrent;
    const legacy = parseBattleReportOutcomeFilterSessionValue(
      storage?.getItem(LEGACY_BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY) ?? null,
    );
    if (!legacy) return null;
    writeBattleReportOutcomeFilterSession(legacy, storage);
    try {
      storage?.removeItem(LEGACY_BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY);
    } catch {
      /* ignore */
    }
    return legacy;
  } catch {
    return null;
  }
}

export function writeBattleReportOutcomeFilterSession(
  filter: BattleReportOutcomeFilter,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.setItem(BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY, filter);
  } catch {
    /* quota / private mode */
  }
}

const TIME_WINDOW_FILTER_VALUES: readonly BattleReportTimeWindowFilter[] = [
  "all",
  "today",
  "last7d",
];

export function parseBattleReportTimeWindowFilterSessionValue(
  raw: string | null | undefined,
): BattleReportTimeWindowFilter | null {
  if (raw == null || raw === "") return null;
  if ((TIME_WINDOW_FILTER_VALUES as readonly string[]).includes(raw)) {
    return raw as BattleReportTimeWindowFilter;
  }
  return null;
}

export function readBattleReportTimeWindowFilterSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): BattleReportTimeWindowFilter | null {
  try {
    return parseBattleReportTimeWindowFilterSessionValue(
      storage?.getItem(BATTLE_REPORT_TIME_WINDOW_FILTER_SESSION_KEY) ?? null,
    );
  } catch {
    return null;
  }
}

export function writeBattleReportTimeWindowFilterSession(
  filter: BattleReportTimeWindowFilter,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.setItem(BATTLE_REPORT_TIME_WINDOW_FILTER_SESSION_KEY, filter);
  } catch {
    /* quota / private mode */
  }
}

/** 是否尚有未拉取的服务端战报（基于已加载条数与 total）。 */
export function hasMoreBattleReports(loadedCount: number, total: number): boolean {
  if (!Number.isFinite(loadedCount) || !Number.isFinite(total)) return false;
  if (loadedCount < 0 || total < 0) return false;
  return loadedCount < total;
}

export function battleReportAllLoadedLabel(total: number): string {
  const n = Number.isFinite(total) && total >= 0 ? Math.trunc(total) : 0;
  return `已加载全部 ${n} 条`;
}
