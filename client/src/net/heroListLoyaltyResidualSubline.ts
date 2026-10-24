import {
  HERO_LIST_DEPLOYABLE_MIN_LOYALTY,
  heroMatchesDeployableFilter,
  type HeroListFilterContext,
} from "@/net/heroListFilter";
import {
  heroListRowShowsLoyaltyWarnDot,
  type HeroListLoyaltySublineSource,
} from "@/net/heroListLoyaltySubline";

/** CLIENT-246：列表行忠诚残余次行 DOM class（CLIENT-213 主行 **不退化**）。 */
export const HERO_LIST_LOYALTY_RESIDUAL_SUBLINE_CLASS = "hero-list-row-loyalty-residual-subline";

export const HERO_LIST_LOYALTY_RESIDUAL_SUBLINE_ROLE = "hero-list-loyalty-residual-subline";

/** CLIENT-246：残余次行低忠诚警示圆点（与主行 `hero-loyalty-warn-dot` 同源阈值）。 */
export const HERO_LOYALTY_RESIDUAL_WARN_DOT_CLASS = "hero-loyalty-residual-warn-dot";

function deployableMinLoyalty(
  hero: HeroListLoyaltySublineSource,
  ctx?: HeroListFilterContext,
): number {
  const id = hero.hero_id ?? 0;
  const fromDetail = id > 0 ? ctx?.detailLoyaltyMinByHeroId?.get(id) : undefined;
  if (fromDetail != null && Number.isFinite(fromDetail)) {
    return Math.max(HERO_LIST_DEPLOYABLE_MIN_LOYALTY, fromDetail);
  }
  return HERO_LIST_DEPLOYABLE_MIN_LOYALTY;
}

/** 列表行是否展示残余次行低忠诚圆点（只读；无 hero 专用升级 RPC）。 */
export function heroListRowShowsLoyaltyResidualWarnDot(
  hero: HeroListLoyaltySublineSource,
  ctx?: HeroListFilterContext,
): boolean {
  return heroListRowShowsLoyaltyWarnDot(hero, ctx);
}

/**
 * 将领列表忠诚 **残余** 次行：主行 `formatHeroListLoyaltySubline` 的阈值/出征态只读对照（CLIENT-246）。
 * 低忠诚圆点由 DOM `hero-loyalty-residual-warn-dot` 承载。
 */
export function formatHeroListLoyaltyResidualSubline(
  hero: HeroListLoyaltySublineSource,
  ctx?: HeroListFilterContext,
): string {
  const loyalty = hero.loyalty ?? 0;
  const threshold = deployableMinLoyalty(hero, ctx);
  const deployable = heroMatchesDeployableFilter(hero, ctx);
  const parts = [`忠诚摘要 ${loyalty}`, `阈${threshold}`];
  parts.push(deployable ? "达阈可出征" : "未达阈不可出征");
  if (heroListRowShowsLoyaltyWarnDot(hero, ctx)) {
    parts.push("低忠诚警示");
  }
  return `忠诚残余 · ${parts.join(" · ")}`;
}
