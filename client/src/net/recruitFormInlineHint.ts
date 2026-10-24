import type { ResourceWallet } from "@/net/bootstrapSession";
import type { BagStack } from "@/net/bagState";
import { categorizeBagStackRow } from "@/net/bagCategory";
import {
  buildHeroBagDeepLinkQuery,
  parseHeroBagDeepLinkQuery,
  serializeHeroBagDeepLinkQuery,
  type HeroBagDeepLinkQuery,
} from "@/net/heroDetailBagDeepLink";
import {
  compareRecruitAffordability,
  recruitAffordabilityForTemplate,
  type RecruitTemplateCost,
} from "@/net/recruitAffordability";
import { heroTemplateLabel, type RecruitTemplatePreview } from "@/net/heroMailState";
import { formatRecruitWalletSweepLine } from "@/net/recruitWalletSweep";

/** 招募表单提交前只读校验行（CLIENT-201）。 */
export const RECRUIT_FORM_INLINE_HINT_ROLE = "recruit-form-inline-hint";
export const RECRUIT_FORM_INLINE_WARN_CLASS = "recruit-form-inline-warn";
export const RECRUIT_GOTO_BAG_ITEM_GAP_ACTION = "recruit-goto-bag-item-gap";
/** 背包堆叠行：自招募道具缺口深链高亮（CLIENT-201；与 CLIENT-165 `item-highlight` 可叠加）。 */
export const BAG_HERO_ITEM_GAP_HIGHLIGHT_CLASS = "bag-hero-item-gap-highlight";
export const RECRUIT_ITEM_GAP_BAG_QUERY_KEY = "recruitItemGap";

export type RecruitFormInlineHint = {
  text: string;
  hasWarn: boolean;
  canSubmit: boolean;
  /** 养成类 `recruit_item` 缺口时的 item_cfg_id（仅道具不足时提供深链）。 */
  itemGapItemCfgId: number | null;
};

export type RecruitItemGapBagDeepLink = {
  itemCfgId: number;
  link: HeroBagDeepLinkQuery;
};

/** 纯函数：模板/币种/余额只读校验行（CLIENT-057/166 口径；不发 RecruitHero）。 */
export function formatRecruitFormInlineHint(
  template: RecruitTemplatePreview | undefined,
  wallet: ResourceWallet | undefined,
  bag: BagStack[] = [],
): RecruitFormInlineHint {
  const tplId = template?.template_cfg_id ?? 0;
  if (!template || tplId <= 0) {
    return {
      text: "请先刷新并选择招募模板",
      hasWarn: true,
      canSubmit: false,
      itemGapItemCfgId: null,
    };
  }
  const name = template.template_name?.trim() || heroTemplateLabel(tplId);
  const { result: afford } = recruitAffordabilityForTemplate(template, wallet, bag);
  const sweep = formatRecruitWalletSweepLine(wallet, template as RecruitTemplateCost, bag);
  const itemLine = afford.lines.find((l) => l.kind === "item" && !l.sufficient);
  const itemCfgId = template.recruit_item?.item_cfg_id ?? 0;
  const itemGapItemCfgId =
    itemLine && itemCfgId > 0 ? Math.floor(itemCfgId) : null;
  const text = `校验：${name} — ${sweep.text}`;
  return {
    text,
    hasWarn: !afford.canAfford,
    canSubmit: afford.canAfford,
    itemGapItemCfgId,
  };
}

/** 招募道具缺口 → 背包深链 query（`highlightItemId` + `recruitItemGap=1`）。 */
export function buildRecruitItemGapBagDeepLink(itemCfgId: number): HeroBagDeepLinkQuery {
  const id = Math.floor(Number(itemCfgId) || 0);
  return buildHeroBagDeepLinkQuery({
    highlightItemId: id,
    bagCategory: categorizeBagStackRow({ item_cfg_id: id, quantity: 1 }),
    openSource: "hero",
    recruitItemGap: true,
  });
}

export function serializeRecruitItemGapBagDeepLink(itemCfgId: number): string {
  return serializeHeroBagDeepLinkQuery(buildRecruitItemGapBagDeepLink(itemCfgId));
}

/** 解析招募道具缺口深链；无 `recruitItemGap` 或缺少 `highlightItemId` 时返回 null。 */
export function parseRecruitItemGapBagDeepLink(
  raw: string | URLSearchParams | null | undefined,
): RecruitItemGapBagDeepLink | null {
  if (raw == null || raw === "") return null;
  const params =
    typeof raw === "string"
      ? new URLSearchParams(raw.startsWith("?") ? raw.slice(1) : raw)
      : raw;
  if (params.get(RECRUIT_ITEM_GAP_BAG_QUERY_KEY) !== "1") return null;
  const link = parseHeroBagDeepLinkQuery(params);
  if (!link?.highlightItemId || link.highlightItemId <= 0) return null;
  if (!link.recruitItemGap) return null;
  return { itemCfgId: link.highlightItemId, link };
}

/** 从模板消耗推导首个道具缺口 item_cfg_id（只读）。 */
export function resolveRecruitTemplateItemGapCfgId(
  template: RecruitTemplateCost | undefined,
  bag: BagStack[] = [],
  wallet?: ResourceWallet,
): number | null {
  if (!template) return null;
  const afford = compareRecruitAffordability(wallet, template, bag);
  const itemLine = afford.lines.find((l) => l.kind === "item" && !l.sufficient);
  const id = template.recruit_item?.item_cfg_id ?? 0;
  if (!itemLine || id <= 0) return null;
  return Math.floor(id);
}

export function syncRecruitFormInlineHintDisplay(
  panel: ParentNode | null | undefined,
  hint: RecruitFormInlineHint,
): void {
  const el = panel?.querySelector<HTMLElement>(`[data-role="${RECRUIT_FORM_INLINE_HINT_ROLE}"]`);
  if (!el) return;
  const show = hint.text.trim().length > 0;
  el.textContent = hint.text;
  el.classList.toggle("hidden", !show);
  el.classList.toggle(RECRUIT_FORM_INLINE_WARN_CLASS, show && hint.hasWarn);
  const bagBtn = panel?.querySelector<HTMLButtonElement>(
    `[data-action="${RECRUIT_GOTO_BAG_ITEM_GAP_ACTION}"]`,
  );
  if (bagBtn) {
    const gapId = hint.itemGapItemCfgId ?? 0;
    const showBag = gapId > 0;
    bagBtn.classList.toggle("hidden", !showBag);
    bagBtn.disabled = !showBag;
    if (showBag) bagBtn.dataset.itemCfgId = String(gapId);
    else delete bagBtn.dataset.itemCfgId;
  }
}
