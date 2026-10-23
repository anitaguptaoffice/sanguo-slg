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

/** 面板打开时仅重绘剩余时间文案的间隔（毫秒）；不触发 ListMarches。 */
export const MARCH_LIST_REMAINING_TICK_MS = 1000;

/** 剩余时间低于该阈值时展示「即将到达」。 */
export const MARCH_REMAINING_SOON_MS = 60_000;

const OUTCOME_LABEL: Record<number, string> = {
  1: "攻胜",
  2: "守胜",
  3: "平局",
};

/** 战报列表客户端筛选（不传给 ListBattleReports）。胜=攻胜(1)、负=守胜(2)、平=平局(3)。 */
export type BattleReportOutcomeFilter = "all" | "win" | "loss" | "draw";

const TROOP_CODE_LABEL: Record<string, string> = {
  infantry: "步兵",
  cavalry: "骑兵",
  archer: "弓兵",
  siege: "器械",
};

const BATTLE_RESULT_LABEL: Record<string, string> = {
  attacker_win: "攻方获胜",
  defender_win: "守方获胜",
};

export function battleReportMatchesOutcomeFilter(
  report: BattleReportSummary,
  filter: BattleReportOutcomeFilter,
): boolean {
  if (filter === "all") return true;
  const outcome = report.outcome ?? 0;
  if (filter === "win") return outcome === 1;
  if (filter === "loss") return outcome === 2;
  if (filter === "draw") return outcome === 3;
  return true;
}

export function filterBattleReportsByOutcome(
  reports: BattleReportSummary[],
  filter: BattleReportOutcomeFilter,
): BattleReportSummary[] {
  return reports.filter((r) => battleReportMatchesOutcomeFilter(r, filter));
}

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
  const primary = formatMarchRowPrimaryLine(m);
  const meta = formatMarchRowMetaLine(m, Date.now());
  return `${primary} · ${meta}`;
}

/** 行军列表主行：#id · 目的 · 阶段 · 坐标。 */
export function formatMarchRowPrimaryLine(m: MarchSummary): string {
  const id = m.march_id ?? "?";
  const purpose = formatMarchPurpose(m.purpose);
  const phase = formatMarchPhase(m.phase);
  const route = formatMarchCoordPair(m.from_x, m.from_y, m.to_x, m.to_y);
  return `#${id} · ${purpose} · ${phase} · ${route}`;
}

/**
 * 相对到达 ETA（仅依据时刻差）。
 * 行军中/撤回中由 {@link formatMarchRowMetaLine} 拼接；待发/已到达等仍用 {@link formatMarchPhase}。
 */
export function formatMarchRemainingMs(nowMs: number, arrive_at_ms: number | undefined): string {
  if (!arrive_at_ms) return "即将到达";
  const remaining = arrive_at_ms - nowMs;
  if (remaining <= MARCH_REMAINING_SOON_MS) return "即将到达";
  const minutes = Math.ceil(remaining / 60_000);
  return `剩余 ${minutes}m`;
}

/** 小地图角标用：与 {@link formatMarchRemainingMs} 同一时刻差口径，仅保留分钟数字或「即将」。 */
export function formatMarchRemainingMsAbbrev(nowMs: number, arrive_at_ms: number | undefined): string {
  if (!arrive_at_ms) return "即将";
  const remaining = arrive_at_ms - nowMs;
  if (remaining <= MARCH_REMAINING_SOON_MS) return "即将";
  return String(Math.ceil(remaining / 60_000));
}

/** 行军列表次行：出发/到达绝对时刻 + 剩余时间或阶段文案。 */
export function formatMarchRowMetaLine(m: MarchSummary, nowMs: number): string {
  const depart = formatTimeMs(m.depart_at_ms);
  const arrive = formatTimeMs(m.arrive_at_ms);
  const timing = `出发 ${depart} · 到达 ${arrive}`;
  const phase = m.phase ?? 0;
  if (phase === 2 || phase === 4) {
    return `${timing} · ${formatMarchRemainingMs(nowMs, m.arrive_at_ms)}`;
  }
  return `${timing} · ${formatMarchPhase(m.phase)}`;
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
  if (!reports.length) return ["暂无战报，出征结算后可在此查看"];
  return reports.map(formatReportLine);
}

/** 战报列表行：守方/对手标签（不含坐标，坐标单独突出展示）。 */
export function formatBattleReportFoeWithoutCoord(r: BattleReportSummary): string {
  const parts: string[] = [];
  if (r.defender_player_id) parts.push(`守方玩家#${r.defender_player_id}`);
  if (r.defender_city_id) parts.push(`城池#${r.defender_city_id}`);
  return parts.length ? parts.join(" · ") : "对手信息未记录";
}

/** 战报列表行：对手/守方摘要（无新 proto 字段时的可读拼接）。 */
export function formatBattleReportFoeSummary(r: BattleReportSummary): string {
  const foe = formatBattleReportFoeWithoutCoord(r);
  const hasCoord = r.location_x != null || r.location_y != null;
  if (!hasCoord) return foe;
  if (foe === "对手信息未记录") return formatReportCoord(r);
  return `${foe} · ${formatReportCoord(r)}`;
}

const OUTCOME_CHIP_CLASS: Record<number, string> = {
  1: "outcome-attacker-win",
  2: "outcome-defender-win",
  3: "outcome-draw",
};

export function battleReportOutcomeChipClass(outcome: number | undefined): string {
  const key = outcome ?? 0;
  return OUTCOME_CHIP_CLASS[key] ?? "outcome-unknown";
}

export function battleReportOutcomeChipLabel(outcome: number | undefined): string {
  return formatBattleOutcome(outcome);
}

export function formatCasualtyMap(casualties: Record<string, number> | undefined): string {
  if (!casualties) return "无";
  const parts = Object.entries(casualties)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([code, n]) => `${TROOP_CODE_LABEL[code] ?? code} ${n}`);
  return parts.length ? parts.join("、") : "无";
}

export function formatBattleResultText(result: string | undefined): string {
  if (!result) return "—";
  return BATTLE_RESULT_LABEL[result] ?? result;
}

export type BattleReportDetailView = {
  result?: string;
  rounds?: {
    round?: number;
    attacker_troops?: Record<string, number>;
    defender_troops?: Record<string, number>;
    attacker_to_def_hp?: number;
    defender_to_att_hp?: number;
  }[];
  attacker_casualties?: Record<string, number>;
  defender_casualties?: Record<string, number>;
};

export type BattleRoundView = NonNullable<BattleReportDetailView["rounds"]>[number];

export function formatBattleRoundLine(round: BattleRoundView | undefined): string {
  if (!round) return "";
  const n = round.round ?? "?";
  const att = formatCasualtyMap(round.attacker_troops);
  const def = formatCasualtyMap(round.defender_troops);
  const dmg = `伤害 攻→守 ${round.attacker_to_def_hp ?? 0} / 守→攻 ${round.defender_to_att_hp ?? 0}`;
  return `第 ${n} 回合 · 攻 ${att} · 守 ${def} · ${dmg}`;
}

export function formatBattleReportDetail(
  reportId: number,
  summary: BattleReportSummary | undefined,
  detail: BattleReportDetailView | undefined,
): string {
  const roundCount = detail?.rounds?.length ?? 0;
  const head = summary ? formatReportLine(summary) : `#${reportId}`;
  return (
    `${head}\n` +
    `结果：${formatBattleResultText(detail?.result)}\n` +
    `回合数：${roundCount}\n` +
    `攻方伤亡：${formatCasualtyMap(detail?.attacker_casualties)}\n` +
    `守方伤亡：${formatCasualtyMap(detail?.defender_casualties)}`
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
