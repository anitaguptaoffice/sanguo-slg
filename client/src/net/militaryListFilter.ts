import { marchEtaDeadline, type MarchSummary } from "@/net/militaryFormat";

/** sessionStorage：军情列表阶段筛选与 ETA 排序（CLIENT-109，仅客户端）。 */
export const MILITARY_LIST_FILTER_SESSION_KEY = "military-list-filter-v1";

export type MilitaryListPhaseFilter =
  | "all"
  | "pending"
  | "outbound"
  | "stationed"
  | "return";

export type MilitaryListEtaSort = "default" | "eta_asc" | "eta_desc";

export type MilitaryListFilterV1 = {
  phase: MilitaryListPhaseFilter;
  etaSort: MilitaryListEtaSort;
};

export const DEFAULT_MILITARY_LIST_FILTER: MilitaryListFilterV1 = {
  phase: "all",
  etaSort: "eta_asc",
};

const PHASE_VALUES: readonly MilitaryListPhaseFilter[] = [
  "all",
  "pending",
  "outbound",
  "stationed",
  "return",
];

const ETA_SORT_VALUES: readonly MilitaryListEtaSort[] = ["default", "eta_asc", "eta_desc"];

export function militaryListPhaseFilterLabel(filter: MilitaryListPhaseFilter): string {
  switch (filter) {
    case "all":
      return "全部";
    case "pending":
      return "待发";
    case "outbound":
      return "行军中";
    case "stationed":
      return "驻扎";
    case "return":
      return "返回";
    default:
      return filter;
  }
}

export function militaryListEtaSortLabel(sort: MilitaryListEtaSort): string {
  switch (sort) {
    case "default":
      return "默认顺序";
    case "eta_asc":
      return "ETA 升序";
    case "eta_desc":
      return "ETA 降序";
    default:
      return sort;
  }
}

export function parseMilitaryListFilterSessionValue(
  raw: string | null | undefined,
): MilitaryListFilterV1 | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed = JSON.parse(raw) as Partial<MilitaryListFilterV1>;
    const phase = parsed.phase;
    const etaSort = parsed.etaSort;
    if (
      phase != null &&
      (PHASE_VALUES as readonly string[]).includes(phase) &&
      etaSort != null &&
      (ETA_SORT_VALUES as readonly string[]).includes(etaSort)
    ) {
      return { phase, etaSort };
    }
  } catch {
    /* invalid JSON */
  }
  return null;
}

export function readMilitaryListFilterSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): MilitaryListFilterV1 {
  try {
    const saved = parseMilitaryListFilterSessionValue(
      storage?.getItem(MILITARY_LIST_FILTER_SESSION_KEY) ?? null,
    );
    return saved ?? DEFAULT_MILITARY_LIST_FILTER;
  } catch {
    return DEFAULT_MILITARY_LIST_FILTER;
  }
}

export function writeMilitaryListFilterSession(
  filter: MilitaryListFilterV1,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    storage?.setItem(MILITARY_LIST_FILTER_SESSION_KEY, JSON.stringify(filter));
  } catch {
    /* quota / private mode */
  }
}

/** 阶段筛选：与 {@link marchPhaseChipLabel} 的 phase 映射一致。 */
export function marchMatchesMilitaryListPhaseFilter(
  march: MarchSummary,
  filter: MilitaryListPhaseFilter,
): boolean {
  if (filter === "all") return true;
  const p = march.phase ?? 0;
  switch (filter) {
    case "pending":
      return p === 1;
    case "outbound":
      return p === 2;
    case "stationed":
      return p === 3;
    case "return":
      return p === 4;
    default:
      return true;
  }
}

export function marchListEtaSortKey(march: MarchSummary, _nowMs: number): number {
  const p = march.phase ?? 0;
  if (p === 2 || p === 4) {
    const arrive = marchEtaDeadline(march);
    if (arrive != null && Number.isFinite(arrive)) return arrive;
    return Number.POSITIVE_INFINITY;
  }
  const depart = march.depart_at_ms;
  if (depart != null && Number.isFinite(depart)) return depart;
  const id = march.march_id;
  if (id != null && Number.isFinite(id)) return id;
  return Number.POSITIVE_INFINITY;
}

export function sortMarchesForMilitaryList(
  marches: MarchSummary[],
  etaSort: MilitaryListEtaSort,
  nowMs: number,
): MarchSummary[] {
  if (etaSort === "default") {
    return sortMarchesForMilitaryList(marches, "eta_asc", nowMs);
  }
  const copy = [...marches];
  copy.sort((a, b) => {
    const ka = marchListEtaSortKey(a, nowMs);
    const kb = marchListEtaSortKey(b, nowMs);
    if (etaSort === "eta_asc") return ka - kb;
    return kb - ka;
  });
  return copy;
}

export function applyMilitaryListClientFilters(
  marches: MarchSummary[],
  filter: MilitaryListFilterV1,
  nowMs: number,
): MarchSummary[] {
  const byPhase = marches.filter((m) =>
    marchMatchesMilitaryListPhaseFilter(m, filter.phase),
  );
  return sortMarchesForMilitaryList(byPhase, filter.etaSort, nowMs);
}
