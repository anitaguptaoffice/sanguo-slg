import type { HeroSummary } from "@/net/heroMailState";

/** 招募模板行「查看将领」：按 `template_cfg_id` 解析已拥有实例的 `hero_id`。 */
export function resolveHeroIdForRecruitTemplate(
  heroes: readonly HeroSummary[],
  templateCfgId: number | undefined,
): number | null {
  const tpl = templateCfgId ?? 0;
  if (tpl <= 0) return null;
  const match = heroes.find((h) => h.template_cfg_id === tpl && (h.hero_id ?? 0) > 0);
  return match?.hero_id ?? null;
}
