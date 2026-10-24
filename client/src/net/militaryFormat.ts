import { localCalendarDayKey } from "@/net/socialFormat";

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
  /** 可选：服务端或 mock 在到达后回填，用于战报深链（CLIENT-025/085）。 */
  report_id?: number;
  /** ListMarches 当前军团编制（CLIENT-093 上次兵力摘要）。 */
  troops?: CityTroopStack[];
  /** 可选：网关 JSON 扩展，行军将领展示名（CLIENT-172 信息卡）。 */
  hero_id?: number;
  hero_name?: string;
  hero_template_name?: string;
  leader_hero_id?: number;
  leader_hero_name?: string;
  leader_hero_template_name?: string;
  /** 可选：目的格玩家展示名（ListMarches JSON 扩展，CLIENT-108）。 */
  to_player_name?: string;
  destination_player_name?: string;
  target_display_name?: string;
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
  /** 可选：网关 JSON 扩展，战报复盘攻守摘要（CLIENT-100）。 */
  attacker_display_name?: string;
  defender_display_name?: string;
  attacker_hero_template_cfg_id?: number;
  defender_hero_template_cfg_id?: number;
  attacker_hero_template_name?: string;
  defender_hero_template_name?: string;
  attacker_hero_id?: number;
  defender_hero_id?: number;
};

const MARCH_PHASE_LABEL: Record<number, string> = {
  0: "未知",
  1: "待发",
  2: "行军中",
  3: "已到达",
  4: "撤回中",
};

/** 军情列表 phase chip 文案（扫读口径：去程/驻扎/返回，与 formatMarchPhase 长文案并存）。 */
const MARCH_PHASE_CHIP_LABEL: Record<number, string> = {
  0: "未知",
  1: "待发",
  2: "去程",
  3: "驻扎",
  4: "返回",
};

const MARCH_PHASE_CHIP_CLASS: Record<number, string> = {
  1: "march-phase-chip-pending",
  2: "march-phase-chip-outbound",
  3: "march-phase-chip-stationed",
  4: "march-phase-chip-return",
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

/** 战报列表时间窗（仅客户端过滤，不改 ListBattleReports）。 */
export type BattleReportTimeWindowFilter = "all" | "today" | "last7d";

export type BattleReportOutcomeCounts = {
  win: number;
  loss: number;
  draw: number;
};

function battleReportCreatedAtMs(report: BattleReportSummary): number {
  const ms = report.created_at_ms ?? 0;
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

/** 近 7 日：含今日在内的连续 7 个本地日历日。 */
export function battleReportLast7DaysCutoffMs(nowMs: number): number {
  const start = new Date(nowMs);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  return start.getTime();
}

export function battleReportMatchesTimeWindowFilter(
  report: BattleReportSummary,
  window: BattleReportTimeWindowFilter,
  nowMs: number,
): boolean {
  if (window === "all") return true;
  const created = battleReportCreatedAtMs(report);
  if (created <= 0) return false;
  if (window === "today") {
    return localCalendarDayKey(created) === localCalendarDayKey(nowMs);
  }
  if (window === "last7d") {
    return created >= battleReportLast7DaysCutoffMs(nowMs);
  }
  return true;
}

export function filterBattleReportsByTimeWindow(
  reports: BattleReportSummary[],
  window: BattleReportTimeWindowFilter,
  nowMs: number,
): BattleReportSummary[] {
  return reports.filter((r) => battleReportMatchesTimeWindowFilter(r, window, nowMs));
}

/** 战报战场格点是否与世界格点一致（只读 location_x/y）。 */
export function battleReportLocationMatchesGrid(
  report: BattleReportSummary,
  x: number,
  y: number,
): boolean {
  const wx = report.location_x;
  const wy = report.location_y;
  if (!Number.isFinite(wx) || !Number.isFinite(wy)) return false;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return wx === x && wy === y;
}

export function filterBattleReportsByLocation(
  reports: BattleReportSummary[],
  x: number,
  y: number,
): BattleReportSummary[] {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
  return reports.filter((r) => battleReportLocationMatchesGrid(r, x, y));
}

/** 在给定列表中取该格点最近一场战报（按 created_at_ms 降序）。 */
export function findMostRecentBattleReportAtGrid(
  reports: BattleReportSummary[],
  x: number,
  y: number,
): BattleReportSummary | null {
  let best: BattleReportSummary | null = null;
  let bestMs = -1;
  for (const r of reports) {
    if (!battleReportLocationMatchesGrid(r, x, y)) continue;
    const ms = battleReportCreatedAtMs(r);
    if (ms > bestMs) {
      bestMs = ms;
      best = r;
    }
  }
  return best;
}

export function countBattleReportsByOutcome(
  reports: BattleReportSummary[],
): BattleReportOutcomeCounts {
  let win = 0;
  let loss = 0;
  let draw = 0;
  for (const r of reports) {
    const outcome = r.outcome ?? 0;
    if (outcome === 1) win += 1;
    else if (outcome === 2) loss += 1;
    else if (outcome === 3) draw += 1;
  }
  return { win, loss, draw };
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

export function marchPhaseChipLabel(phase: number | undefined): string {
  return MARCH_PHASE_CHIP_LABEL[phase ?? 0] ?? `阶段${phase}`;
}

export function marchPhaseChipClass(phase: number | undefined): string {
  const p = phase ?? 0;
  return MARCH_PHASE_CHIP_CLASS[p] ?? "march-phase-chip-unknown";
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

/** 军情列表目的格点（含可选玩家展示名，CLIENT-108 扩展字段）。 */
export function formatMarchListDestCell(m: MarchSummary): string {
  const coord = `(${m.to_x ?? "?"},${m.to_y ?? "?"})`;
  const display =
    m.to_player_name?.trim() ||
    m.destination_player_name?.trim() ||
    m.target_display_name?.trim();
  return display ? `${coord} · ${display}` : coord;
}

/** 军情列表模板摘要：出征目的 + #id + ListMarches 编制快照。 */
export function formatMarchListTemplateSummary(m: MarchSummary): string {
  const parts: string[] = [formatMarchPurpose(m.purpose)];
  if (m.march_id != null) parts.push(`#${m.march_id}`);
  const troops = formatTroopStacks(m.troops);
  if (troops && troops !== "无") parts.push(troops);
  return parts.join(" · ");
}

/** 军情列表主行：目的格点 + 模板摘要（CLIENT-141）。 */
export function formatMarchListPrimaryLine(m: MarchSummary): string {
  const dest = formatMarchListDestCell(m);
  const summary = formatMarchListTemplateSummary(m);
  return summary ? `${dest} · ${summary}` : dest;
}

/** 军情列表次行：arrive_at_ms 剩余 ETA + phase 中文标签（CLIENT-141）。 */
export function formatMarchListSecondary(m: MarchSummary, nowMs: number): string {
  const phase = m.phase ?? 0;
  const phaseLabel = formatMarchPhase(phase);
  const etaPart =
    phase === 2 || phase === 4
      ? formatMarchRemainingMs(nowMs, m.arrive_at_ms)
      : phaseLabel;
  if (etaPart === phaseLabel) return phaseLabel;
  return `${etaPart} · ${phaseLabel}`;
}

/** 行军列表主行：#id · 目的 · 坐标（阶段由列表行 chip 展示）。 */
export function formatMarchRowPrimaryLine(m: MarchSummary): string {
  const id = m.march_id ?? "?";
  const purpose = formatMarchPurpose(m.purpose);
  const route = formatMarchCoordPair(m.from_x, m.from_y, m.to_x, m.to_y);
  return `#${id} · ${purpose} · ${route}`;
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

/** DOM `data-role`：军情新高亮行行内 ETA 扫读（CLIENT-116）。 */
export const MARCH_ROW_RECENT_ETA_ROLE = "march-row-recent-eta";

/**
 * 新高亮行军行行内 ETA 摘要（与 CLIENT-089 / CLIENT-047 {@link formatMarchRemainingMs} 同源）。
 * 用于 `march-row-recent` 行的只读前缀，完整时刻仍见 {@link formatMarchRowMetaLine}。
 */
export function formatMarchRowRecentEtaBrief(m: MarchSummary, nowMs: number): string | null {
  const phase = m.phase ?? 0;
  if (phase === 2 || phase === 4) {
    return `ETA ${formatMarchRemainingMs(nowMs, m.arrive_at_ms)}`;
  }
  const phaseLabel = formatMarchPhase(phase);
  if (!phaseLabel) return null;
  return `ETA ${phaseLabel}`;
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

/** 战报列表次行可点击坐标标签文案（CLIENT-223；与 {@link formatReportCoord} 同源）。 */
export function formatBattleReportCoordinateTag(r: BattleReportSummary): string {
  return formatReportCoord(r);
}

/** 列表次行扫读：胜负与攻守方，不含坐标（坐标由 {@link formatBattleReportCoordinateTag} 标签展示）。 */
export function formatBattleReportRowSummarySansCoord(r: BattleReportSummary): string {
  const outcome = formatBattleOutcome(r.outcome);
  const attacker = battleReportListSideShort("attacker", r);
  const defender = battleReportListSideShort("defender", r);
  return `${outcome} · 攻:${attacker} vs 守:${defender}`;
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

function battleReportListSideShort(
  side: "attacker" | "defender",
  r: BattleReportSummary,
): string {
  if (side === "attacker") {
    const name = r.attacker_display_name?.trim();
    if (name) return name;
    if (r.attacker_player_id) return `玩家#${r.attacker_player_id}`;
    return "攻方";
  }
  const name = r.defender_display_name?.trim();
  if (name) return name;
  if (r.defender_player_id) return `玩家#${r.defender_player_id}`;
  if (r.defender_city_id) return `城池#${r.defender_city_id}`;
  return "守方";
}

/** 战报列表主行：战报标题 + 时间（CLIENT-176）。 */
export function formatBattleReportListPrimaryLine(r: BattleReportSummary): string {
  const id = r.report_id ?? "?";
  const title = formatBattleReportFoeWithoutCoord(r);
  const when = formatTimeMs(r.created_at_ms);
  return `#${id} · ${title} · ${when}`;
}

/** 战报列表次行：胜负 + 攻守方简称 + 坐标（ListBattleReports 既有字段，CLIENT-176）。 */
export function formatBattleReportRowSummary(r: BattleReportSummary): string {
  const outcome = formatBattleOutcome(r.outcome);
  const attacker = battleReportListSideShort("attacker", r);
  const defender = battleReportListSideShort("defender", r);
  const coord = formatReportCoord(r);
  return `${outcome} · 攻:${attacker} vs 守:${defender} · ${coord}`;
}

/**
 * 战报列表次行扫读：在 {@link formatBattleReportRowSummary} 基础上，若该行开启一段连续胜/负 streak（≥2），附加只读 streak 摘要（CLIENT-207）。
 * `reportsInListOrder` 须与列表展示顺序一致（通常为时间倒序）。
 */
export function formatBattleReportListStreakLine(
  report: BattleReportSummary,
  index: number,
  reportsInListOrder: readonly BattleReportSummary[],
): string {
  const base = formatBattleReportRowSummarySansCoord(report);
  const outcome = report.outcome ?? 0;
  if (outcome !== 1 && outcome !== 2) return base;
  if (
    index > 0 &&
    (reportsInListOrder[index - 1]?.outcome ?? 0) === outcome
  ) {
    return base;
  }
  let count = 0;
  for (let i = index; i < reportsInListOrder.length; i++) {
    if ((reportsInListOrder[i]?.outcome ?? 0) === outcome) count += 1;
    else break;
  }
  if (count < 2) return base;
  const streakLabel = outcome === 1 ? `连胜 ${count}` : `连负 ${count}`;
  return `${base} · ${streakLabel}`;
}

/** 战报详情顶栏 outcome 色带主文案（CLIENT-190；只读 ListBattleReports 字段）。 */
export const BATTLE_REPORT_OUTCOME_BAND_CLASS = "battle-report-outcome-band";

export function formatBattleReportOutcomeHeadline(r: BattleReportSummary): string {
  const outcome = formatBattleOutcome(r.outcome);
  const id = r.report_id ?? "?";
  const foe = formatBattleReportFoeWithoutCoord(r);
  return `${outcome} · 战报 #${id} · ${foe}`;
}

/** 战报详情 outcome 色带下方回合摘要条（CLIENT-208；只读既有 detail JSON）。 */
export const BATTLE_REPORT_ROUND_SUMMARY_STRIP_CLASS = "battle-report-round-summary-strip";

function battleReportRoundNumberSpan(
  rounds: BattleReportDetailView["rounds"],
): { first: number; last: number } | null {
  if (!rounds?.length) return null;
  const nums = rounds
    .map((r) => r.round)
    .filter((n): n is number => n != null && n > 0);
  if (!nums.length) {
    const n = rounds.length;
    return { first: 1, last: n };
  }
  return { first: nums[0], last: nums[nums.length - 1] };
}

export function formatBattleReportRoundSummaryStrip(
  detail: BattleReportDetailView | undefined,
): string {
  if (!detail) return "";
  const span = battleReportRoundNumberSpan(detail.rounds);
  const attLoss = formatCasualtyMap(detail.attacker_casualties);
  const defLoss = formatCasualtyMap(detail.defender_casualties);
  if (!span && attLoss === "无" && defLoss === "无") return "";
  const roundPart = span
    ? span.first === span.last
      ? `第 ${span.first} 回合`
      : `第 ${span.first}–${span.last} 回合`
    : "回合：—";
  return `${roundPart} · 攻方伤亡 ${attLoss} · 守方伤亡 ${defLoss}`;
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
  attacker_hero_level?: number;
  defender_hero_level?: number;
  rounds?: {
    round?: number;
    attacker_troops?: Record<string, number>;
    defender_troops?: Record<string, number>;
    attacker_to_def_hp?: number;
    defender_to_att_hp?: number;
  }[];
  attacker_casualties?: Record<string, number>;
  defender_casualties?: Record<string, number>;
  final_attacker?: Record<string, number>;
  final_defender?: Record<string, number>;
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
