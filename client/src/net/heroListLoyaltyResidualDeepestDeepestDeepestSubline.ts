import type { HeroListFilterContext } from "@/net/heroListFilter";
import { clampHeroUpgradeProgressPercent } from "@/net/heroGrowthCompareFormat";
import {
  formatHeroListLoyaltyResidualDeepestDeepestDeeperSubline,
  heroListRowShowsLoyaltyResidualDeepestDeepestDeeperWarnDot,
  type HeroListLoyaltyResidualDeepestDeepestDeeperSublineSource,
} from "@/net/heroListLoyaltyResidualDeepestDeepestDeeperSubline";

/** CLIENT-342：列表行忠诚残余 **巩固再加深四层** 次行 DOM class（CLIENT-326 再加深三层次行 **不退化**）。 */
export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_CLASS =
  "hero-list-row-loyalty-residual-deepest-deepest-deepest-subline";

export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_ROLE =
  "hero-list-loyalty-residual-deepest-deepest-deepest-subline";

/** CLIENT-342：巩固再加深四层次行低忠诚圆点（与 CLIENT-326 再加深三层圆点同源阈值）。 */
export const HERO_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_WARN_DOT_CLASS =
  "hero-loyalty-residual-deepest-deepest-deepest-warn-dot";

export type HeroListLoyaltyResidualDeepestDeepestDeepestSublineSource =
  HeroListLoyaltyResidualDeepestDeepestDeeperSublineSource;

function formatExpProgressReadonly(
  hero: HeroListLoyaltyResidualDeepestDeepestDeepestSublineSource,
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

/** 列表行是否展示巩固再加深四层低忠诚圆点（只读；无 hero 专用升级 RPC）。 */
export function heroListRowShowsLoyaltyResidualDeepestDeepestDeepestWarnDot(
  hero: HeroListLoyaltyResidualDeepestDeepestDeepestSublineSource,
  ctx?: HeroListFilterContext,
): boolean {
  return heroListRowShowsLoyaltyResidualDeepestDeepestDeeperWarnDot(hero, ctx);
}

/**
 * 将领列表忠诚 + 经验进度只读 **巩固再加深四层** 第四行（CLIENT-342；CLIENT-326 **不退化**）。
 */
export function formatHeroListLoyaltyResidualDeepestDeepestDeepestSubline(
  hero: HeroListLoyaltyResidualDeepestDeepestDeepestSublineSource,
  ctx?: HeroListFilterContext,
): string {
  const loyalty = hero.loyalty ?? 0;
  const deepestDeepestDeeperScan = formatHeroListLoyaltyResidualDeepestDeepestDeeperSubline(hero, ctx);
  const parts = [`忠诚 ${loyalty}`, formatExpProgressReadonly(hero), `再加深 ${deepestDeepestDeeperScan}`];
  if (heroListRowShowsLoyaltyResidualDeepestDeepestDeeperWarnDot(hero, ctx)) {
    parts.push("低忠诚再加深四层警示");
  }
  return `忠诚巩固再加深四层 · ${parts.join(" · ")}`;
}
