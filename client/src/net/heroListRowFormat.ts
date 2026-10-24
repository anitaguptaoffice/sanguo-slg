import type { HeroAttributes, HeroSummary } from "@/net/heroMailState";
import { heroTemplateLabel } from "@/net/heroMailState";

/** 列表次行无四维时的养成入口提示（无装备槽 proto）。 */
export const HERO_LIST_ROW_SECONDARY_DETAIL_HINT = "详情查看养成";

/** wave:27 列表行九宫资产 id（可选挂载）。 */
export const HERO_LIST_ROW_PANEL_SKIN_ID = "ui.panel.listrow.default.v1";

export type HeroListRowSource = HeroSummary & {
  template_name?: string;
  attributes?: HeroAttributes;
};

export function formatHeroAttributesAbbrev(attrs: HeroAttributes): string {
  return `武${attrs.force ?? 0} 智${attrs.intel ?? 0} 政${attrs.politics ?? 0} 统${attrs.command ?? 0}`;
}

function heroListRowDisplayName(h: HeroListRowSource): string {
  const fromApi = h.template_name?.trim();
  if (fromApi) return fromApi;
  return heroTemplateLabel(h.template_cfg_id);
}

/** 主行：模板名 + Lv.N + 忠诚摘要。 */
export function formatHeroListRowPrimary(h: HeroListRowSource): string {
  const name = heroListRowDisplayName(h);
  const level = h.level ?? 1;
  const loyalty = h.loyalty ?? 0;
  return `${name} · Lv${level} · 忠诚 ${loyalty}`;
}

export type HeroListRowSecondaryOptions = {
  /** 已加载详情时的四维（列表 RPC 无 attributes 时由 UI 注入）。 */
  detailAttributes?: HeroAttributes | null;
};

function hasHeroAttributes(attrs: HeroAttributes): boolean {
  return [attrs.force, attrs.intel, attrs.politics, attrs.command].some(
    (v) => v != null && Number.isFinite(Number(v)),
  );
}

/** 次行：四维缩写，或详情养成提示。 */
export function formatHeroListRowSecondary(
  h: HeroListRowSource,
  opts?: HeroListRowSecondaryOptions,
): string {
  const attrs = opts?.detailAttributes ?? h.attributes;
  if (attrs && hasHeroAttributes(attrs)) {
    return formatHeroAttributesAbbrev(attrs);
  }
  return HERO_LIST_ROW_SECONDARY_DETAIL_HINT;
}

/** 将领面板列表行 DOM 源（合并详情缓存中的展示名/忠诚）。 */
export function resolveHeroListRowSource(
  hero: HeroSummary,
  detail: HeroListRowSource | null | undefined,
): HeroListRowSource {
  if (!detail || detail.hero_id !== hero.hero_id) {
    return hero;
  }
  return {
    ...hero,
    template_name: detail.template_name ?? hero.template_name,
    level: detail.level ?? hero.level,
    loyalty: detail.loyalty ?? hero.loyalty,
    attributes: detail.attributes,
  };
}
