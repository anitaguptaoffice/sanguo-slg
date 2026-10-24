import type { HeroListFilterContext } from "@/net/heroListFilter";
import { clampHeroUpgradeProgressPercent } from "@/net/heroGrowthCompareFormat";
import {
  formatHeroListLoyaltyResidualDeepSubline,
  heroListRowShowsLoyaltyResidualDeepWarnDot,
  type HeroListLoyaltyResidualDeepSublineSource,
} from "@/net/heroListLoyaltyResidualDeepSubline";

/** CLIENT-278：列表行忠诚残余 **巩固再加深** 次行 DOM class（CLIENT-262 深巩固次行 **不退化**）。 */
export const HERO_LIST_LOYALTY_RESIDUAL_DEEPER_SUBLINE_CLASS =
  "hero-list-row-loyalty-residual-deeper-subline";

export const HERO_LIST_LOYALTY_RESIDUAL_DEEPER_SUBLINE_ROLE =
  "hero-list-loyalty-residual-deeper-subline";

/** CLIENT-278：巩固再加深次行低忠诚圆点（与 CLIENT-262 深巩固圆点同源阈值）。 */
export const HERO_LOYALTY_RESIDUAL_DEEPER_WARN_DOT_CLASS =
  "hero-loyalty-residual-deeper-warn-dot";

export type HeroListLoyaltyResidualDeeperSublineSource = HeroListLoyaltyResidualDeepSublineSource;

function formatExpProgressReadonly(hero: HeroListLoyaltyResidualDeeperSublineSource): string {
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

/** 列表行是否展示巩固再加深低忠诚圆点（只读；无 hero 专用升级 RPC）。 */
export function heroListRowShowsLoyaltyResidualDeeperWarnDot(
  hero: HeroListLoyaltyResidualDeeperSublineSource,
  ctx?: HeroListFilterContext,
): boolean {
  return heroListRowShowsLoyaltyResidualDeepWarnDot(hero, ctx);
}

/**
 * 将领列表忠诚 + 经验进度只读 **巩固再加深** 第三行（CLIENT-278；CLIENT-262 **不退化**）。
 */
export function formatHeroListLoyaltyResidualDeeperSubline(
  hero: HeroListLoyaltyResidualDeeperSublineSource,
  ctx?: HeroListFilterContext,
): string {
  const loyalty = hero.loyalty ?? 0;
  const deepScan = formatHeroListLoyaltyResidualDeepSubline(hero, ctx);
  const parts = [`忠诚 ${loyalty}`, formatExpProgressReadonly(hero), `深巩固 ${deepScan}`];
  if (heroListRowShowsLoyaltyResidualDeepWarnDot(hero, ctx)) {
    parts.push("低忠诚再加深警示");
  }
  return `忠诚巩固再加深 · ${parts.join(" · ")}`;
}
