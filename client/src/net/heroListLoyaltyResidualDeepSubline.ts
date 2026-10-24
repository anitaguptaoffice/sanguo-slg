import type { HeroListFilterContext } from "@/net/heroListFilter";
import { clampHeroUpgradeProgressPercent } from "@/net/heroGrowthCompareFormat";
import {
  formatHeroListLoyaltyResidualSubline,
  heroListRowShowsLoyaltyResidualWarnDot,
} from "@/net/heroListLoyaltyResidualSubline";
import type { HeroListLoyaltySublineSource } from "@/net/heroListLoyaltySubline";

/** CLIENT-262：列表行忠诚残余 **深巩固** 次行 DOM class（CLIENT-246 残余次行 **不退化**）。 */
export const HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_CLASS =
  "hero-list-row-loyalty-residual-deep-subline";

export const HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_ROLE =
  "hero-list-loyalty-residual-deep-subline";

/** CLIENT-262：深巩固次行低忠诚圆点（与 CLIENT-246 `hero-loyalty-residual-warn-dot` 同源阈值）。 */
export const HERO_LOYALTY_RESIDUAL_DEEP_WARN_DOT_CLASS = "hero-loyalty-residual-deep-warn-dot";

export type HeroListLoyaltyResidualDeepSublineSource = HeroListLoyaltySublineSource & {
  /** 详情缓存或网关可选：本级经验进度（只读；无 hero 专用升级 RPC）。 */
  exp_current?: number;
  exp_to_next?: number;
};

function formatExpProgressReadonly(hero: HeroListLoyaltyResidualDeepSublineSource): string {
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

/** 列表行是否展示深巩固低忠诚圆点（只读；无 hero 专用升级 RPC）。 */
export function heroListRowShowsLoyaltyResidualDeepWarnDot(
  hero: HeroListLoyaltyResidualDeepSublineSource,
  ctx?: HeroListFilterContext,
): boolean {
  return heroListRowShowsLoyaltyResidualWarnDot(hero, ctx);
}

/**
 * 将领列表忠诚 + 经验进度只读 **深巩固** 次行（CLIENT-262；CLIENT-246 残余次行 **不退化**）。
 */
export function formatHeroListLoyaltyResidualDeepSubline(
  hero: HeroListLoyaltyResidualDeepSublineSource,
  ctx?: HeroListFilterContext,
): string {
  const loyalty = hero.loyalty ?? 0;
  const residualScan = formatHeroListLoyaltyResidualSubline(hero, ctx);
  const parts = [`忠诚 ${loyalty}`, formatExpProgressReadonly(hero), `残余 ${residualScan}`];
  if (heroListRowShowsLoyaltyResidualWarnDot(hero, ctx)) {
    parts.push("低忠诚深警示");
  }
  return `忠诚深巩固 · ${parts.join(" · ")}`;
}
