import type { HeroListFilterContext } from "@/net/heroListFilter";
import { clampHeroUpgradeProgressPercent } from "@/net/heroGrowthCompareFormat";
import {
  formatHeroListLoyaltyResidualDeepestSubline,
  heroListRowShowsLoyaltyResidualDeepestWarnDot,
  type HeroListLoyaltyResidualDeepestSublineSource,
} from "@/net/heroListLoyaltyResidualDeepestSubline";

/** CLIENT-310：列表行忠诚残余 **巩固再加深二层** 次行 DOM class（CLIENT-294 再加深一层次行 **不退化**）。 */
export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPER_SUBLINE_CLASS =
  "hero-list-row-loyalty-residual-deepest-deeper-subline";

export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPER_SUBLINE_ROLE =
  "hero-list-loyalty-residual-deepest-deeper-subline";

/** CLIENT-310：巩固再加深二层次行低忠诚圆点（与 CLIENT-294 再加深一层圆点同源阈值）。 */
export const HERO_LOYALTY_RESIDUAL_DEEPEST_DEEPER_WARN_DOT_CLASS =
  "hero-loyalty-residual-deepest-deeper-warn-dot";

export type HeroListLoyaltyResidualDeepestDeeperSublineSource =
  HeroListLoyaltyResidualDeepestSublineSource;

function formatExpProgressReadonly(
  hero: HeroListLoyaltyResidualDeepestDeeperSublineSource,
): string {
  const expMax = hero.exp_to_next;
  const expCur = hero.exp_current;
  if (expMax != null && expMax <= 0) {
    return "经验已满";
  }
  if (expCur != null && expMax != null && expMax > 0) {
    const pct = clampHeroUpgradeProgressPercent(expCur, expMax);
    const pctSuffix = pct != null ? ` · ${pct}%` : "";
    return `经验 ${expCur}/${expMax}${pctSuffix}`;
  }
  return "经验待详情";
}

/** 列表行是否展示巩固再加深二层低忠诚圆点（只读；无 hero 专用升级 RPC）。 */
export function heroListRowShowsLoyaltyResidualDeepestDeeperWarnDot(
  hero: HeroListLoyaltyResidualDeepestDeeperSublineSource,
  ctx?: HeroListFilterContext,
): boolean {
  return heroListRowShowsLoyaltyResidualDeepestWarnDot(hero, ctx);
}

/**
 * 将领列表忠诚 + 经验进度只读 **巩固再加深二层** 第四行（CLIENT-310；CLIENT-294 **不退化**）。
 */
export function formatHeroListLoyaltyResidualDeepestDeeperSubline(
  hero: HeroListLoyaltyResidualDeepestDeeperSublineSource,
  ctx?: HeroListFilterContext,
): string {
  const loyalty = hero.loyalty ?? 0;
  const deepestScan = formatHeroListLoyaltyResidualDeepestSubline(hero, ctx);
  const parts = [`忠诚 ${loyalty}`, formatExpProgressReadonly(hero), `再加深 ${deepestScan}`];
  if (heroListRowShowsLoyaltyResidualDeepestWarnDot(hero, ctx)) {
    parts.push("低忠诚再加深二层警示");
  }
  return `忠诚巩固再加深二层 · ${parts.join(" · ")}`;
}
