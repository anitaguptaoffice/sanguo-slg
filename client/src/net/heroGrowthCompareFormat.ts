import type { HeroDetail, HeroUpgradeProgressBar } from "@/net/heroMailState";

export const HERO_GROWTH_COMPARE_STRIP_CLASS = "hero-growth-compare-strip";
export const HERO_UPGRADE_PROGRESS_BAR_CLASS = "hero-upgrade-progress-bar";
export const HERO_UPGRADE_PROGRESS_BAR_FILL_CLASS = "hero-upgrade-progress-bar-fill";
export const HERO_UPGRADE_PROGRESS_LINE_CLASS = "hero-upgrade-progress-line";

/** 0–100；max≤0 时为 null。 */
export function clampHeroUpgradeProgressPercent(current: number, max: number): number | null {
  if (max <= 0) return null;
  const raw = (current / max) * 100;
  if (!Number.isFinite(raw)) return 0;
  return Math.min(100, Math.max(0, Math.round(raw)));
}

/**
 * 将领详情顶栏只读对比：当前等级/忠诚 vs 下一档（CLIENT-072/133 口径，不发 hero RPC）。
 */
export function formatHeroGrowthCompareStrip(detail: HeroDetail | null | undefined): string | null {
  if (!detail?.hero_id) return null;
  const level = detail.level ?? 1;
  const loyalty = detail.loyalty ?? 0;
  const parts: string[] = [];

  const expMax = detail.exp_to_next;
  if (expMax != null && expMax <= 0) {
    parts.push(`等级 Lv${level}（已满）`);
  } else {
    parts.push(`等级 Lv${level}→Lv${level + 1}`);
  }

  const lmax = detail.loyalty_max;
  if (lmax != null && loyalty >= lmax) {
    parts.push(`忠诚 ${loyalty}（已满）`);
  } else if (lmax != null) {
    parts.push(`忠诚 ${loyalty}→${Math.min(loyalty + 1, lmax)}`);
  } else {
    parts.push(`忠诚 ${loyalty}→${loyalty + 1}`);
  }

  return parts.join(" · ");
}

/** 养成进度条次行扫读：caption + 百分比。 */
export function formatHeroUpgradeProgressLine(bar: HeroUpgradeProgressBar): string {
  return `${bar.caption} · ${bar.percent}%`;
}
