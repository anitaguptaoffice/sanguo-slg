import type { HeroListFilterContext } from "@/net/heroListFilter";
import { clampHeroUpgradeProgressPercent } from "@/net/heroGrowthCompareFormat";
import {
  formatHeroListLoyaltyResidualDeepestDeepestDeepestDeeperSubline,
  heroListRowShowsLoyaltyResidualDeepestDeepestDeepestDeeperWarnDot,
  type HeroListLoyaltyResidualDeepestDeepestDeepestDeeperSublineSource,
} from "@/net/heroListLoyaltyResidualDeepestDeepestDeepestDeeperSubline";

/** CLIENT-374：列表行忠诚残余 **wave:58 巩固再加深五层** 次行 DOM class（CLIENT-358 再加深五层次行 **不退化**）。 */
export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS =
  "hero-list-row-loyalty-residual-deepest-deepest-deepest-deepest-deeper-subline";

export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE =
  "hero-list-loyalty-residual-deepest-deepest-deepest-deepest-deeper-subline";

/** CLIENT-374：wave:58 巩固再加深五层次行低忠诚圆点（与 CLIENT-358 再加深五层圆点同源阈值）。 */
export const HERO_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_WARN_DOT_CLASS =
  "hero-loyalty-residual-deepest-deepest-deepest-deepest-deeper-warn-dot";

export type HeroListLoyaltyResidualDeepestDeepestDeepestDeepestDeeperSublineSource =
  HeroListLoyaltyResidualDeepestDeepestDeepestDeeperSublineSource;

function formatExpProgressReadonly(
  hero: HeroListLoyaltyResidualDeepestDeepestDeepestDeepestDeeperSublineSource,
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

/** 列表行是否展示 wave:58 巩固再加深五层低忠诚圆点（只读；无 hero 专用升级 RPC）。 */
export function heroListRowShowsLoyaltyResidualDeepestDeepestDeepestDeepestDeeperWarnDot(
  hero: HeroListLoyaltyResidualDeepestDeepestDeepestDeepestDeeperSublineSource,
  ctx?: HeroListFilterContext,
): boolean {
  return heroListRowShowsLoyaltyResidualDeepestDeepestDeepestDeeperWarnDot(hero, ctx);
}

/**
 * 将领列表忠诚 + 经验进度只读 **wave:58 巩固再加深五层** 第四行（CLIENT-374；CLIENT-358 **不退化**）。
 */
export function formatHeroListLoyaltyResidualDeepestDeepestDeepestDeepestDeeperSubline(
  hero: HeroListLoyaltyResidualDeepestDeepestDeepestDeepestDeeperSublineSource,
  ctx?: HeroListFilterContext,
): string {
  const loyalty = hero.loyalty ?? 0;
  const deepestDeepestDeepestDeeperScan = formatHeroListLoyaltyResidualDeepestDeepestDeepestDeeperSubline(
    hero,
    ctx,
  );
  const parts = [
    `忠诚 ${loyalty}`,
    formatExpProgressReadonly(hero),
    `再加深 ${deepestDeepestDeepestDeeperScan}`,
  ];
  if (heroListRowShowsLoyaltyResidualDeepestDeepestDeepestDeeperWarnDot(hero, ctx)) {
    parts.push("低忠诚再加深五层警示");
  }
  return `忠诚巩固再加深五层 · ${parts.join(" · ")}`;
}
