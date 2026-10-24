import type { BagStack } from "@/net/bagState";
import { itemLabel } from "@/net/contentFormat";
import { validateUseConsumable } from "@/net/contentFormValidation";
import { HERO_GOTO_BAG_CULTIVATION_LABEL } from "@/net/heroDetailBagDeepLink";
import {
  HERO_CULTIVATION_CONSUMABLE_CFG_IDS,
  filterHeroCultivationBagItemIds,
  type HeroDetail,
} from "@/net/heroMailState";
import {
  USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL,
  type UseConsumableSubmitState,
  useConsumableSubmitButtonsDisabled,
} from "@/net/useConsumableSubmitFeedback";

export const HERO_DETAIL_CULTIVATION_USE_DEFAULT_LABEL = "使用养成道具";
export const HERO_DETAIL_STAT_PULSE_CLASS = "hero-detail-stat-pulse";
/** 详情区等级/忠诚变化脉冲时长（与背包行脉冲同量级）。 */
export const HERO_DETAIL_STAT_PULSE_MS = 3000;

/** 详情区养成道具：优先使用背包中首个已知养成消耗品（×1）。 */
export function pickHeroCultivationUseItemCfgId(bag: BagStack[]): number | null {
  const ids = filterHeroCultivationBagItemIds(bag);
  return ids[0] ?? null;
}

export function validateHeroDetailCultivationUse(bag: BagStack[]): {
  ok: boolean;
  message: string;
  itemCfgId: number | null;
} {
  const itemCfgId = pickHeroCultivationUseItemCfgId(bag);
  if (!itemCfgId) {
    return { ok: false, message: "背包暂无养成消耗品（将魂碎晶等）", itemCfgId: null };
  }
  const validated = validateUseConsumable({ itemCfgId, count: 1, bag });
  if (!validated.ok) {
    return { ok: false, message: validated.message, itemCfgId };
  }
  return { ok: true, message: "", itemCfgId };
}

export function heroDetailCultivationUseButtonDisabled(
  submitState: UseConsumableSubmitState,
  bag: BagStack[],
): boolean {
  const validation = validateHeroDetailCultivationUse(bag);
  return useConsumableSubmitButtonsDisabled(submitState) || !validation.ok;
}

export function heroDetailCultivationUseButtonLabel(submitState: UseConsumableSubmitState): string {
  return submitState === "submitting"
    ? USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL
    : HERO_DETAIL_CULTIVATION_USE_DEFAULT_LABEL;
}

/** 使用成功后对比 GetHeroDetail 前后 level/loyalty 的可读摘要。 */
export function formatHeroDetailStatChangeSummary(
  before: HeroDetail | null | undefined,
  after: HeroDetail | null | undefined,
): string {
  if (!after?.hero_id) return "详情已刷新";
  const parts: string[] = [];
  const levelBefore = before?.level ?? after.level ?? 1;
  const levelAfter = after.level ?? 1;
  if (levelAfter !== levelBefore) {
    parts.push(`等级 Lv${levelBefore}→Lv${levelAfter}`);
  } else {
    parts.push(`等级 Lv${levelAfter}`);
  }
  const loyaltyBefore = before?.loyalty ?? after.loyalty ?? 0;
  const loyaltyAfter = after.loyalty ?? 0;
  if (loyaltyAfter !== loyaltyBefore) {
    parts.push(`忠诚 ${loyaltyBefore}→${loyaltyAfter}`);
  } else {
    parts.push(`忠诚 ${loyaltyAfter}`);
  }
  return parts.join(" · ");
}

export function formatHeroDetailCultivationUseStatus(
  itemCfgId: number,
  statSummary: string,
  effectSummary?: string,
): string {
  const itemName = itemLabel(itemCfgId);
  const effect = effectSummary?.trim();
  if (effect) {
    return `已使用 ${itemName}×1：${statSummary}（${effect}）`;
  }
  return `已使用 ${itemName}×1：${statSummary}`;
}

export function heroDetailCultivationDisabledReason(bag: BagStack[]): string | null {
  const validation = validateHeroDetailCultivationUse(bag);
  return validation.ok ? null : validation.message;
}

export function renderHeroDetailCultivationUseMarkup(
  bag: BagStack[],
  submitState: UseConsumableSubmitState,
): string {
  const validation = validateHeroDetailCultivationUse(bag);
  const disabled = heroDetailCultivationUseButtonDisabled(submitState, bag);
  const label = heroDetailCultivationUseButtonLabel(submitState);
  const itemHint =
    validation.itemCfgId != null
      ? `将消耗 ${itemLabel(validation.itemCfgId)}×1`
      : `可用养成道具：${HERO_CULTIVATION_CONSUMABLE_CFG_IDS.map((id) => itemLabel(id)).join("、")}`;
  const reason = validation.ok ? "" : validation.message;
  return `<div class="hero-detail-cultivation-use" aria-label="养成道具使用">
    <button type="button" data-action="hero-use-cultivation-item"${disabled ? " disabled" : ""}>${label}</button>
    <button type="button" data-action="hero-goto-bag-cultivation">${HERO_GOTO_BAG_CULTIVATION_LABEL}</button>
    <p class="hero-cultivation-item-hint">${itemHint}</p>
    <p class="march-form-error-sibling hero-cultivation-disabled-reason${reason ? "" : " hidden"}" data-role="hero-cultivation-disabled-reason">${reason}</p>
    <p class="march-form-error-sibling hidden" data-role="hero-cultivation-form-error" role="alert"></p>
    <p class="hero-cultivation-success hidden" data-role="hero-cultivation-success" role="status"></p>
  </div>`;
}

export function setHeroCultivationFormErrorDisplay(
  panelRoot: ParentNode | null | undefined,
  message: string | null,
): void {
  const el = panelRoot?.querySelector('[data-role="hero-cultivation-form-error"]');
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

export function setHeroCultivationSuccessDisplay(
  panelRoot: ParentNode | null | undefined,
  message: string | null,
): void {
  const el = panelRoot?.querySelector('[data-role="hero-cultivation-success"]');
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

export function syncHeroDetailCultivationUseButton(
  panelRoot: ParentNode | null | undefined,
  submitState: UseConsumableSubmitState,
  bag: BagStack[],
): void {
  const btn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="hero-use-cultivation-item"]');
  if (!btn) return;
  btn.disabled = heroDetailCultivationUseButtonDisabled(submitState, bag);
  btn.textContent = heroDetailCultivationUseButtonLabel(submitState);
}

export function scheduleHeroDetailStatPulse(detailEl: HTMLElement | null | undefined): void {
  if (!detailEl) return;
  const head = detailEl.querySelector(".hero-detail-head") ?? detailEl;
  head.classList.remove(HERO_DETAIL_STAT_PULSE_CLASS);
  void (head as HTMLElement).offsetWidth;
  head.classList.add(HERO_DETAIL_STAT_PULSE_CLASS);
  window.setTimeout(() => head.classList.remove(HERO_DETAIL_STAT_PULSE_CLASS), HERO_DETAIL_STAT_PULSE_MS);
}
