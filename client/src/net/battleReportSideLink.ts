import type { HeroSummary } from "@/net/heroMailState";
import { heroTemplateLabel } from "@/net/heroMailState";
import {
  LB_PLAYER_POWER,
  type LeaderboardEntryRow,
} from "@/net/leaderboardFormat";
import type {
  BattleReportDetailView,
  BattleReportSummary,
} from "@/net/militaryFormat";

/** GetBattleReport 只读视图（summary + detail，可含网关 JSON 扩展字段）。 */
export type BattleReportViewSnapshot = {
  summary?: BattleReportSummary;
  detail?: BattleReportDetailView;
};

export type BattleReportSideLinkContext = {
  viewerPlayerId?: number;
  viewerHeroes?: HeroSummary[];
};

export type BattleReportSideSummaryParts = {
  /** 顶栏一行摘要：攻/守玩家名与模板名。 */
  headline: string;
  attackerLine: string;
  defenderLine: string;
};

export type BattleReportHeroDeepLink = {
  action: "open" | "readonly";
  heroId?: number;
  message?: string;
};

export type BattleReportRankDeepLink = {
  show: boolean;
  boardType: number;
  entityId?: number;
};

function playerLabel(
  playerId: number | undefined,
  displayName: string | undefined,
): string {
  const trimmed = displayName?.trim();
  if (trimmed) return trimmed;
  if (playerId && playerId > 0) return `玩家#${playerId}`;
  return "—";
}

function sideTemplateLabel(
  summary: BattleReportSummary | undefined,
  side: "attacker" | "defender",
  detail?: BattleReportDetailView,
): string {
  if (!summary) return "主将未记录";
  if (side === "attacker") {
    const name = summary.attacker_hero_template_name?.trim();
    if (name) return name;
    if (summary.attacker_hero_template_cfg_id) {
      return heroTemplateLabel(summary.attacker_hero_template_cfg_id);
    }
    const lv = detail?.attacker_hero_level;
    if (lv != null && lv > 0) return `将领 Lv${lv}`;
    return "主将未记录";
  }
  const name = summary.defender_hero_template_name?.trim();
  if (name) return name;
  if (summary.defender_hero_template_cfg_id) {
    return heroTemplateLabel(summary.defender_hero_template_cfg_id);
  }
  const lv = detail?.defender_hero_level;
  if (lv != null && lv > 0) return `将领 Lv${lv}`;
  if (summary.defender_city_id) return "城池守军";
  return "主将未记录";
}

function formatSideLine(
  role: string,
  summary: BattleReportSummary | undefined,
  side: "attacker" | "defender",
  detail?: BattleReportDetailView,
): string {
  if (!summary) return `${role}：—`;
  if (side === "defender" && !summary.defender_player_id && summary.defender_city_id) {
    return `${role}：城池#${summary.defender_city_id} · ${sideTemplateLabel(summary, side, detail)}`;
  }
  const pid =
    side === "attacker" ? summary.attacker_player_id : summary.defender_player_id;
  const display =
    side === "attacker"
      ? summary.attacker_display_name
      : summary.defender_display_name;
  const player = playerLabel(pid, display);
  const tpl = sideTemplateLabel(summary, side, detail);
  return `${role}：${player} · ${tpl}`;
}

/** 战报详情顶栏攻守一行摘要（纯函数）。 */
export function formatBattleReportSideSummary(
  report: BattleReportViewSnapshot | undefined,
): BattleReportSideSummaryParts {
  const summary = report?.summary;
  const detail = report?.detail;
  const attackerLine = formatSideLine("攻", summary, "attacker", detail);
  const defenderLine = formatSideLine("守", summary, "defender", detail);
  return {
    headline: `${attackerLine} | ${defenderLine}`,
    attackerLine,
    defenderLine,
  };
}

export function pickBattleHeroIdForPlayer(
  heroes: HeroSummary[] | undefined,
  preferredHeroId?: number,
): number {
  if (preferredHeroId && preferredHeroId > 0) return preferredHeroId;
  const list = heroes ?? [];
  if (!list.length) return 0;
  const sorted = [...list].sort((a, b) => (b.level ?? 0) - (a.level ?? 0));
  return sorted[0]?.hero_id ?? 0;
}

export function resolveBattleReportHeroDeepLink(
  side: "attacker" | "defender",
  report: BattleReportViewSnapshot | undefined,
  ctx: BattleReportSideLinkContext,
): BattleReportHeroDeepLink {
  const summary = report?.summary;
  if (!summary) {
    return { action: "readonly", message: "战报摘要缺失，无法打开将领" };
  }
  const viewerId = ctx.viewerPlayerId ?? 0;
  const attackerId = summary.attacker_player_id ?? 0;
  const defenderId = summary.defender_player_id ?? 0;

  if (side === "attacker") {
    if (!viewerId || viewerId !== attackerId) {
      return { action: "readonly", message: "仅支持查看己方攻方将领" };
    }
    const heroId = pickBattleHeroIdForPlayer(
      ctx.viewerHeroes,
      summary.attacker_hero_id,
    );
    if (!heroId) {
      return { action: "readonly", message: "己方将领列表为空，请先招募" };
    }
    return { action: "open", heroId };
  }

  if (!defenderId) {
    return { action: "readonly", message: "守方为城池/NPC，将领详情只读不可用" };
  }
  if (!viewerId || viewerId !== defenderId) {
    return { action: "readonly", message: "仅支持查看己方守方将领" };
  }
  const heroId = pickBattleHeroIdForPlayer(
    ctx.viewerHeroes,
    summary.defender_hero_id,
  );
  if (!heroId) {
    return { action: "readonly", message: "己方将领列表为空，请先招募" };
  }
  return { action: "open", heroId };
}

/** 战力榜高亮：优先对手玩家，否则攻方玩家。 */
export function resolveBattleReportRankDeepLink(
  report: BattleReportViewSnapshot | undefined,
  ctx: BattleReportSideLinkContext,
): BattleReportRankDeepLink {
  const summary = report?.summary;
  if (!summary) return { show: false, boardType: LB_PLAYER_POWER };
  const viewerId = ctx.viewerPlayerId ?? 0;
  const attackerId = summary.attacker_player_id ?? 0;
  const defenderId = summary.defender_player_id ?? 0;
  let entityId = 0;
  if (viewerId && viewerId === attackerId && defenderId > 0) {
    entityId = defenderId;
  } else if (viewerId && viewerId === defenderId && attackerId > 0) {
    entityId = attackerId;
  } else if (attackerId > 0) {
    entityId = attackerId;
  } else if (defenderId > 0) {
    entityId = defenderId;
  }
  if (!entityId) return { show: false, boardType: LB_PLAYER_POWER };
  return { show: true, boardType: LB_PLAYER_POWER, entityId };
}

export function leaderboardRowDomId(entityId: number): string {
  return `rank-row-entity-${entityId}`;
}

export function findLeaderboardEntryForEntity(
  entries: LeaderboardEntryRow[] | undefined,
  entityId: number,
): LeaderboardEntryRow | undefined {
  if (!entityId) return undefined;
  return (entries ?? []).find((e) => (e.entity_id ?? 0) === entityId);
}
