/** CLIENT-198: 将领详情养成前后对比与升级进度条（软依赖 DOM；manifest 登记）。 */
export const HERO_GROWTH_COMPARE_STRIP_CLASS = "hero-growth-compare-strip";
export const HERO_UPGRADE_PROGRESS_BAR_CLASS = "hero-upgrade-progress-bar";

export type HeroGrowthCompareInput = {
  level: number;
  loyalty?: number | null;
  nextLevel?: number | null;
};

export function formatHeroGrowthCompareStrip(input: HeroGrowthCompareInput): string {
  const loyalty = input.loyalty ?? 0;
  const next = input.nextLevel ?? input.level + 1;
  return `Lv${input.level}→${next} · 忠诚 ${loyalty}`;
}

export function formatHeroUpgradeProgressLine(
  currentExp: number,
  needExp: number,
): { percent: number; line: string } {
  const need = needExp > 0 ? needExp : 1;
  const percent = Math.min(100, Math.max(0, Math.round((currentExp / need) * 100)));
  return { percent, line: `经验 ${currentExp}/${need} (${percent}%)` };
}
