import {
  formatMarchCoordPair,
  formatMarchPhase,
  formatMarchRemainingMs,
  formatTroopStacks,
  type MarchSummary,
} from "@/net/militaryFormat";

export const MARCH_INFO_CARD_CLASS = "march-info-card";
export const MARCH_ROW_SELECTED_CLASS = "march-row-selected";
export const MARCH_INFO_FORCE_HINT = "暂无兵力/将领快照";

/** 信息卡次行 ETA 口径（与 CLIENT-141 / CLIENT-047 剩余时间同源）。 */
export function formatMarchEtaLine(m: MarchSummary, nowMs: number): string {
  const phase = m.phase ?? 0;
  if (phase === 2 || phase === 4) {
    return `ETA ${formatMarchRemainingMs(nowMs, m.arrive_at_ms)}`;
  }
  return `ETA ${formatMarchPhase(phase)}`;
}

/** 信息卡主行：阶段 + 起终点坐标。 */
export function formatMarchInfoCardPrimary(m: MarchSummary): string {
  const phase = formatMarchPhase(m.phase);
  const route = formatMarchCoordPair(m.from_x, m.from_y, m.to_x, m.to_y);
  return `${phase} · ${route}`;
}

function formatMarchHeroSummary(m: MarchSummary): string | null {
  const name =
    m.hero_name?.trim() ||
    m.hero_template_name?.trim() ||
    m.leader_hero_name?.trim() ||
    m.leader_hero_template_name?.trim();
  if (name) return `将领 ${name}`;
  if (m.hero_id != null && m.hero_id > 0) return `将领#${m.hero_id}`;
  if (m.leader_hero_id != null && m.leader_hero_id > 0) {
    return `将领#${m.leader_hero_id}`;
  }
  return null;
}

/** ListMarches 快照兵力 + 可选将领字段；均无则 null。 */
export function formatMarchForceSummary(m: MarchSummary): string | null {
  const troops = formatTroopStacks(m.troops);
  const hasTroops = Boolean(troops && troops !== "无");
  const hero = formatMarchHeroSummary(m);
  if (!hasTroops && !hero) return null;
  const parts: string[] = [];
  if (hasTroops) parts.push(troops);
  if (hero) parts.push(hero);
  return parts.join(" · ");
}

/** 信息卡次行：ETA + 兵力/将领摘要（无快照时 hint）。 */
export function formatMarchInfoCardSecondary(m: MarchSummary, nowMs: number): string {
  const eta = formatMarchEtaLine(m, nowMs);
  const force = formatMarchForceSummary(m);
  if (!force) return `${eta} · ${MARCH_INFO_FORCE_HINT}`;
  return `${eta} · ${force}`;
}
