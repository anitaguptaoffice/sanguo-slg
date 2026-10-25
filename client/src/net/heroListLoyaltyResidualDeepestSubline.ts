import type { HeroListFilterContext } from "@/net/heroListFilter";
import { clampHeroUpgradeProgressPercent } from "@/net/heroGrowthCompareFormat";
import {
  formatHeroListLoyaltyResidualDeeperSubline,
  heroListRowShowsLoyaltyResidualDeeperWarnDot,
  type HeroListLoyaltyResidualDeeperSublineSource,
} from "@/net/heroListLoyaltyResidualDeeperSubline";

/** CLIENT-294：列表行忠诚残余 **巩固再加深一层** 次行 DOM class（CLIENT-278 再加深次行 **不退化**）。 */
export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_SUBLINE_CLASS =
  "hero-list-row-loyalty-residual-deepest-subline";

export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_SUBLINE_ROLE =
  "hero-list-loyalty-residual-deepest-subline";

/** CLIENT-294：巩固再加深一层次行低忠诚圆点（与 CLIENT-278 再加深圆点同源阈值）。 */
export const HERO_LOYALTY_RESIDUAL_DEEPEST_WARN_DOT_CLASS =
  "hero-loyalty-residual-deepest-warn-dot";

export type HeroListLoyaltyResidualDeepestSublineSource = HeroListLoyaltyResidualDeeperSublineSource;

function formatExpProgressReadonly(hero: HeroListLoyaltyResidualDeepestSublineSource): string {
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

/** 列表行是否展示巩固再加深一层低忠诚圆点（只读；无 hero 专用升级 RPC）。 */
export function heroListRowShowsLoyaltyResidualDeepestWarnDot(
  hero: HeroListLoyaltyResidualDeepestSublineSource,
  ctx?: HeroListFilterContext,
): boolean {
  return heroListRowShowsLoyaltyResidualDeeperWarnDot(hero, ctx);
}

/**
 * 将领列表忠诚 + 经验进度只读 **巩固再加深一层** 第三行（CLIENT-294；CLIENT-278 **不退化**）。
 */
export function formatHeroListLoyaltyResidualDeepestSubline(
  hero: HeroListLoyaltyResidualDeepestSublineSource,
  ctx?: HeroListFilterContext,
): string {
  const loyalty = hero.loyalty ?? 0;
  const deeperScan = formatHeroListLoyaltyResidualDeeperSubline(hero, ctx);
  const parts = [`忠诚 ${loyalty}`, formatExpProgressReadonly(hero), `再加深 ${deeperScan}`];
  if (heroListRowShowsLoyaltyResidualDeeperWarnDot(hero, ctx)) {
    parts.push("低忠诚再加深一层警示");
  }
  return `忠诚巩固再加深一层 · ${parts.join(" · ")}`;
}
