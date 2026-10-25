import type { HeroListFilterContext } from "@/net/heroListFilter";
import { clampHeroUpgradeProgressPercent } from "@/net/heroGrowthCompareFormat";
import {
  formatHeroListLoyaltyResidualDeepestDeepestDeepestSubline,
  heroListRowShowsLoyaltyResidualDeepestDeepestDeepestWarnDot,
  type HeroListLoyaltyResidualDeepestDeepestDeepestSublineSource,
} from "@/net/heroListLoyaltyResidualDeepestDeepestDeepestSubline";

/** CLIENT-358：列表行忠诚残余 **巩固再加深五层** 次行 DOM class（CLIENT-342 再加深四层次行 **不退化**）。 */
export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS =
  "hero-list-row-loyalty-residual-deepest-deepest-deepest-deeper-subline";

export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE =
  "hero-list-loyalty-residual-deepest-deepest-deepest-deeper-subline";

/** CLIENT-358：巩固再加深五层次行低忠诚圆点（与 CLIENT-342 再加深四层圆点同源阈值）。 */
export const HERO_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_WARN_DOT_CLASS =
  "hero-loyalty-residual-deepest-deepest-deepest-deeper-warn-dot";

export type HeroListLoyaltyResidualDeepestDeepestDeepestDeeperSublineSource =
  HeroListLoyaltyResidualDeepestDeepestDeepestSublineSource;

function formatExpProgressReadonly(
  hero: HeroListLoyaltyResidualDeepestDeepestDeepestDeeperSublineSource,
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

/** 列表行是否展示巩固再加深五层低忠诚圆点（只读；无 hero 专用升级 RPC）。 */
export function heroListRowShowsLoyaltyResidualDeepestDeepestDeepestDeeperWarnDot(
  hero: HeroListLoyaltyResidualDeepestDeepestDeepestDeeperSublineSource,
  ctx?: HeroListFilterContext,
): boolean {
  return heroListRowShowsLoyaltyResidualDeepestDeepestDeepestWarnDot(hero, ctx);
}

/**
 * 将领列表忠诚 + 经验进度只读 **巩固再加深五层** 第四行（CLIENT-358；CLIENT-342 **不退化**）。
 */
export function formatHeroListLoyaltyResidualDeepestDeepestDeepestDeeperSubline(
  hero: HeroListLoyaltyResidualDeepestDeepestDeepestDeeperSublineSource,
  ctx?: HeroListFilterContext,
): string {
  const loyalty = hero.loyalty ?? 0;
  const deepestDeepestDeepestScan = formatHeroListLoyaltyResidualDeepestDeepestDeepestSubline(hero, ctx);
  const parts = [`忠诚 ${loyalty}`, formatExpProgressReadonly(hero), `再加深 ${deepestDeepestDeepestScan}`];
  if (heroListRowShowsLoyaltyResidualDeepestDeepestDeepestWarnDot(hero, ctx)) {
    parts.push("低忠诚再加深五层警示");
  }
  return `忠诚巩固再加深五层 · ${parts.join(" · ")}`;
}
