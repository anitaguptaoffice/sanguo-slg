import type { HeroListFilterContext } from "@/net/heroListFilter";
import { clampHeroUpgradeProgressPercent } from "@/net/heroGrowthCompareFormat";
import {
  formatHeroListLoyaltyResidualDeepestDeeperSubline,
  heroListRowShowsLoyaltyResidualDeepestDeeperWarnDot,
  type HeroListLoyaltyResidualDeepestDeeperSublineSource,
} from "@/net/heroListLoyaltyResidualDeepestDeeperSubline";

/** CLIENT-326：列表行忠诚残余 **巩固再加深三层** 次行 DOM class（CLIENT-310 再加深二层次行 **不退化**）。 */
export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS =
  "hero-list-row-loyalty-residual-deepest-deepest-deeper-subline";

export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE =
  "hero-list-loyalty-residual-deepest-deepest-deeper-subline";

/** CLIENT-326：巩固再加深三层次行低忠诚圆点（与 CLIENT-310 再加深二层圆点同源阈值）。 */
export const HERO_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPER_WARN_DOT_CLASS =
  "hero-loyalty-residual-deepest-deepest-deeper-warn-dot";

export type HeroListLoyaltyResidualDeepestDeepestDeeperSublineSource =
  HeroListLoyaltyResidualDeepestDeeperSublineSource;

function formatExpProgressReadonly(
  hero: HeroListLoyaltyResidualDeepestDeepestDeeperSublineSource,
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

/** 列表行是否展示巩固再加深三层低忠诚圆点（只读；无 hero 专用升级 RPC）。 */
export function heroListRowShowsLoyaltyResidualDeepestDeepestDeeperWarnDot(
  hero: HeroListLoyaltyResidualDeepestDeepestDeeperSublineSource,
  ctx?: HeroListFilterContext,
): boolean {
  return heroListRowShowsLoyaltyResidualDeepestDeeperWarnDot(hero, ctx);
}

/**
 * 将领列表忠诚 + 经验进度只读 **巩固再加深三层** 第四行（CLIENT-326；CLIENT-294 **不退化**）。
 */
export function formatHeroListLoyaltyResidualDeepestDeepestDeeperSubline(
  hero: HeroListLoyaltyResidualDeepestDeepestDeeperSublineSource,
  ctx?: HeroListFilterContext,
): string {
  const loyalty = hero.loyalty ?? 0;
  const deepestDeeperScan = formatHeroListLoyaltyResidualDeepestDeeperSubline(hero, ctx);
  const parts = [`忠诚 ${loyalty}`, formatExpProgressReadonly(hero), `再加深 ${deepestDeeperScan}`];
  if (heroListRowShowsLoyaltyResidualDeepestDeeperWarnDot(hero, ctx)) {
    parts.push("低忠诚再加深三层警示");
  }
  return `忠诚巩固再加深三层 · ${parts.join(" · ")}`;
}
