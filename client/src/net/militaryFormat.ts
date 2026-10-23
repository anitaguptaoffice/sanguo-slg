/** 兵种配置 ID → 展示名（与 spec/data cfg_unit 一致）。 */
export const UNIT_LABEL: Record<number, string> = {
  1: "步兵",
  2: "骑兵",
  3: "弓兵",
  4: "器械",
};

export type CityTroopStack = {
  unit_cfg_id?: number;
  count?: number;
  wounded?: number;
};

export type MarchSummary = {
  march_id?: number;
  phase?: number;
  from_x?: number;
  from_y?: number;
  to_x?: number;
  to_y?: number;
  depart_at_ms?: number;
  arrive_at_ms?: number;
  purpose?: number;
};

export type BattleReportSummary = {
  report_id?: number;
  attacker_player_id?: number;
  defender_player_id?: number;
  defender_city_id?: number;
  location_x?: number;
  location_y?: number;
  outcome?: number;
  created_at_ms?: number;
};

const MARCH_PHASE_LABEL: Record<number, string> = {
  0: "未知",
  1: "待发",
  2: "行军中",
  3: "已到达",
  4: "撤回中",
};

const MARCH_PURPOSE_LABEL: Record<number, string> = {
  1: "攻击",
  2: "增援",
  3: "采集",
};

/** 行军列表面板打开时的默认轮询间隔（毫秒）。 */
export const MARCH_LIST_POLL_MS = 5000;

const OUTCOME_LABEL: Record<number, string> = {
  1: "攻胜",
  2: "守胜",
  3: "平局",
};

export function unitLabel(unitCfgId: number): string {
  return UNIT_LABEL[unitCfgId] ?? `兵种#${unitCfgId}`;
}

export function formatTroopStacks(stacks: CityTroopStack[] | undefined): string {
  if (!stacks?.length) return "无";
  return stacks
    .filter((s) => (s.count ?? 0) > 0)
    .map((s) => `${unitLabel(s.unit_cfg_id ?? 0)}×${s.count ?? 0}`)
    .join("、");
}

export function formatMarchPhase(phase: number | undefined): string {
  return MARCH_PHASE_LABEL[phase ?? 0] ?? `阶段${phase}`;
}

export function formatMarchPurpose(purpose: number | undefined): string {
  return MARCH_PURPOSE_LABEL[purpose ?? 0] ?? `目的${purpose ?? "?"}`;
}

export function formatMarchCoordPair(
  fromX: number | undefined,
  fromY: number | undefined,
  toX: number | undefined,
  toY: number | undefined,
): string {
  const from = `(${fromX ?? "?"},${fromY ?? "?"})`;
  const to = `(${toX ?? "?"},${toY ?? "?"})`;
  return `${from} → ${to}`;
}

export function formatMarchLine(m: MarchSummary): string {
  const id = m.march_id ?? "?";
  const purpose = formatMarchPurpose(m.purpose);
  const phase = formatMarchPhase(m.phase);
  const route = formatMarchCoordPair(m.from_x, m.from_y, m.to_x, m.to_y);
  const depart = formatTimeMs(m.depart_at_ms);
  const arrive = formatTimeMs(m.arrive_at_ms);
  return `#${id} ${purpose} · ${phase} · ${route} · 出发 ${depart} · 到达 ${arrive}`;
}

export function marchListLines(marches: MarchSummary[]): string[] {
  if (!marches.length) return ["（暂无行军，出征后在此查看进度）"];
  return marches.map(formatMarchLine);
}

/** 是否仍需轮询刷新（进行中阶段）。 */
export function marchNeedsPoll(marches: MarchSummary[]): boolean {
  return marches.some((m) => {
    const p = m.phase ?? 0;
    return p === 1 || p === 2 || p === 4;
  });
}

export function formatTimeMs(ms: number | undefined): string {
  if (!ms) return "—";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("zh-CN", { hour12: false });
}

export function formatMarchHint(march: MarchSummary | undefined): string {
  if (!march?.march_id) return "";
  const dest = `(${march.to_x ?? "?"},${march.to_y ?? "?"})`;
  const phase = formatMarchPhase(march.phase);
  const arrive = formatTimeMs(march.arrive_at_ms);
  return `行军 #${march.march_id} → ${dest} · ${phase} · 预计到达 ${arrive}`;
}

export function formatBattleOutcome(outcome: number | undefined): string {
  return OUTCOME_LABEL[outcome ?? 0] ?? `结果${outcome}`;
}

/** 交战坐标摘要（列表项「对手坐标」口径：战场格点）。 */
export function formatReportCoord(r: BattleReportSummary): string {
  return `坐标(${r.location_x ?? "?"},${r.location_y ?? "?"})`;
}

export function formatReportLine(r: BattleReportSummary): string {
  const when = formatTimeMs(r.created_at_ms);
  const coord = formatReportCoord(r);
  return `#${r.report_id ?? "?"} ${coord} ${formatBattleOutcome(r.outcome)} · ${when}`;
}

export function battleReportListLines(reports: BattleReportSummary[]): string[] {
  if (!reports.length) return ["（暂无战报，出征结算后可在此查看）"];
  return reports.map(formatReportLine);
}

export function formatBattleReportDetail(
  reportId: number,
  summary: BattleReportSummary | undefined,
  detail: {
    result?: string;
    rounds?: { round?: number }[];
    attacker_casualties?: Record<string, number>;
    defender_casualties?: Record<string, number>;
  } | undefined,
): string {
  const rounds = detail?.rounds?.length ?? 0;
  return (
    `${summary ? formatReportLine(summary) : `#${reportId}`}\n` +
    `结果：${detail?.result ?? "—"}\n` +
    `回合数：${rounds}\n` +
    `攻方伤亡：${JSON.stringify(detail?.attacker_casualties ?? {})}\n` +
    `守方伤亡：${JSON.stringify(detail?.defender_casualties ?? {})}\n` +
    `（明细字段随服务端 battle 输出；占位展示）`
  );
}

/** 从城内兵力中选主兵种用于出征（优先步兵，取可用数量上限）。 */
export function pickMarchTroops(
  cityTroops: CityTroopStack[],
  unitCfgId: number,
  desiredCount: number,
): CityTroopStack[] {
  const stack = cityTroops.find((t) => t.unit_cfg_id === unitCfgId);
  const available = stack?.count ?? 0;
  const count = Math.min(Math.max(desiredCount, 0), available);
  if (count <= 0) return [];
  return [{ unit_cfg_id: unitCfgId, count }];
}

/** 用服务端返回的单兵种或 city_troops 快照合并进本地列表。 */
export function mergeCityTroops(
  current: CityTroopStack[],
  updates: CityTroopStack[],
): CityTroopStack[] {
  const map = new Map<number, CityTroopStack>();
  for (const t of current) {
    if (t.unit_cfg_id != null) map.set(t.unit_cfg_id, { ...t });
  }
  for (const u of updates) {
    if (u.unit_cfg_id == null) continue;
    map.set(u.unit_cfg_id, { ...map.get(u.unit_cfg_id), ...u });
  }
  return [...map.values()].filter((t) => (t.count ?? 0) > 0 || (t.wounded ?? 0) > 0);
}
