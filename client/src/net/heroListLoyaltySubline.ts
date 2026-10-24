import {
  heroMatchesDeployableFilter,
  type HeroListFilterContext,
} from "@/net/heroListFilter";
import type { HeroSummary } from "@/net/heroMailState";

/** CLIENT-213：列表行忠诚次行 DOM class。 */
export const HERO_LIST_LOYALTY_SUBLINE_CLASS = "hero-list-row-loyalty-subline";

/** CLIENT-213：低忠诚警示圆点（与 `ListPlayerHeroes` 忠诚字段同源）。 */
export const HERO_LOYALTY_WARN_DOT_CLASS = "hero-loyalty-warn-dot";

export const HERO_LIST_LOYALTY_SUBLINE_ROLE = "hero-list-loyalty-subline";

export type HeroListLoyaltySublineSource = HeroSummary & {
  /** 网关可选软字段（proto 未冻结前只读展示）。 */
  morale?: number;
};

function numField(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** 规范化 `ListPlayerHeroes` 行（保留可选士气软字段）。 */
export function normalizeListPlayerHeroSummary(
  raw: HeroSummary | Record<string, unknown>,
): HeroListLoyaltySublineSource {
  const r = raw as Record<string, unknown>;
  return {
    hero_id: numField(r.hero_id),
    template_cfg_id: numField(r.template_cfg_id),
    level: numField(r.level),
    loyalty: numField(r.loyalty),
    morale: numField(r.morale ?? r.morale_value),
  };
}

/** 忠诚低于可出征阈值时展示警示圆点。 */
export function heroListRowShowsLoyaltyWarnDot(
  hero: HeroListLoyaltySublineSource,
  ctx?: HeroListFilterContext,
): boolean {
  return !heroMatchesDeployableFilter(hero, ctx);
}

/**
 * 将领列表忠诚次行：忠诚/士气只读摘要 + 可出征态（CLIENT-151 阈值口径）。
 * 低忠诚圆点由 DOM `hero-loyalty-warn-dot` 承载，不在文案中重复。
 */
export function formatHeroListLoyaltySubline(
  hero: HeroListLoyaltySublineSource,
  ctx?: HeroListFilterContext,
): string {
  const loyalty = hero.loyalty ?? 0;
  const parts: string[] = [`忠诚 ${loyalty}`];
  const morale = hero.morale;
  if (morale != null && Number.isFinite(morale)) {
    parts.push(`士气 ${morale}`);
  }
  parts.push(heroMatchesDeployableFilter(hero, ctx) ? "可出征" : "不可出征");
  return parts.join(" · ");
}
