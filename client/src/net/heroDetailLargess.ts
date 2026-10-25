import type { BagStack } from "@/net/bagState";
import { bagStackQuantity } from "@/net/bagState";
import type { ResourceWallet } from "@/net/bootstrapSession";
import { formatWalletPrice, itemLabel } from "@/net/contentFormat";
import { formatPanelGatewayErrorFromUnknown } from "@/net/contentFormValidation";
import type { HeroDetail } from "@/net/heroMailState";
import {
  USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL,
  type UseConsumableSubmitState,
  useConsumableSubmitButtonsDisabled,
} from "@/net/useConsumableSubmitFeedback";
import { formatUpgradeRemaining } from "@/net/hudFormat";

/** 与服务端 hero.LargessCooldown 一致：15 分钟共享冷却。 */
export const LARGESS_COOLDOWN_SEC = 15 * 60;

export const LARGESS_GIFT_KIND_GOLD = 1;
export const LARGESS_GIFT_KIND_ITEM = 2;

/** 与服务端 DefaultLargessGoods 对齐的赏赐道具档位（非商城 SKU）。 */
export const LARGESS_ITEM_LOYALTY_GAIN: Record<number, number> = {
  2050: 5,
  2051: 10,
  2052: 15,
  2053: 20,
  2054: 25,
  2055: 30,
  2056: 40,
  2057: 50,
  2058: 60,
};

export const LARGESS_ITEM_CFG_IDS = Object.keys(LARGESS_ITEM_LOYALTY_GAIN)
  .map((k) => Number(k))
  .sort((a, b) => a - b);

export type HeroLargessGiftMode = "gold" | "item";

export type LargessHeroResult = {
  hero_id?: number;
  loyalty?: number;
  loyalty_delta?: number;
  gold_spent?: number;
  item_cfg_id?: number;
  next_largess_at_ms?: number;
};

export const HERO_DETAIL_LARGESS_SUBMIT_DEFAULT_LABEL = "赏赐";
export const HERO_DETAIL_LARGESS_COOLDOWN_HINT = "赏赐冷却中，请稍后再试";

export function parseLargessHeroResponse(raw: unknown): LargessHeroResult {
  const r = raw as Record<string, unknown>;
  return {
    hero_id: numField(r.hero_id ?? r.heroId),
    loyalty: numField(r.loyalty),
    loyalty_delta: numField(r.loyalty_delta ?? r.loyaltyDelta),
    gold_spent: numField(r.gold_spent ?? r.goldSpent),
    item_cfg_id: numField(r.item_cfg_id ?? r.itemCfgId),
    next_largess_at_ms: numField(r.next_largess_at_ms ?? r.nextLargessAtMs),
  };
}

function numField(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** 与服务端 HeroSalary + goldLargessCost 同口径的展示用估算。 */
export function estimateHeroSalary(detail: HeroDetail | null | undefined): number {
  if (!detail) return 0;
  const level = detail.level ?? 1;
  const attrs = detail.attributes ?? {};
  const over = (stat: number) => (stat <= 90 ? 0 : (stat - 90) * 50);
  return (
    level * 20 +
    over(attrs.politics ?? 0) +
    over(attrs.force ?? 0) +
    over(attrs.intel ?? 0)
  );
}

export function estimateGoldLargessCost(detail: HeroDetail | null | undefined): number {
  return estimateHeroSalary(detail) * 5;
}

export function filterLargessBagItemIds(bag: BagStack[]): number[] {
  return LARGESS_ITEM_CFG_IDS.filter((id) => bagStackQuantity(bag, id) > 0);
}

export function pickDefaultLargessItemCfgId(bag: BagStack[]): number | null {
  const ids = filterLargessBagItemIds(bag);
  return ids[0] ?? null;
}

export function largessCooldownRemainingMs(nextLargessAtMs: number | null | undefined, nowMs: number): number {
  if (!nextLargessAtMs || nextLargessAtMs <= 0) return 0;
  return Math.max(0, nextLargessAtMs - nowMs);
}

export function isLargessOnCooldown(nextLargessAtMs: number | null | undefined, nowMs: number): boolean {
  return largessCooldownRemainingMs(nextLargessAtMs, nowMs) > 0;
}

export function formatLargessCooldownLine(nextLargessAtMs: number | null | undefined, nowMs: number): string {
  const rem = largessCooldownRemainingMs(nextLargessAtMs, nowMs);
  if (rem <= 0) return "";
  const text = formatUpgradeRemaining(nextLargessAtMs ?? undefined, nowMs);
  return text ? `赏赐冷却 ${text}` : `赏赐冷却中`;
}

export function largessGiftKindProto(mode: HeroLargessGiftMode): number {
  return mode === "item" ? LARGESS_GIFT_KIND_ITEM : LARGESS_GIFT_KIND_GOLD;
}

export function validateHeroDetailLargessSubmit(
  detail: HeroDetail | null | undefined,
  bag: BagStack[],
  wallet: ResourceWallet,
  mode: HeroLargessGiftMode,
  itemCfgId: number | null,
  nextLargessAtMs: number | null | undefined,
  nowMs: number,
): { ok: boolean; message: string; itemCfgId: number | null } {
  if (!detail?.hero_id) {
    return { ok: false, message: "请先点选将领", itemCfgId: null };
  }
  if (isLargessOnCooldown(nextLargessAtMs, nowMs)) {
    return { ok: false, message: formatLargessCooldownLine(nextLargessAtMs, nowMs) || HERO_DETAIL_LARGESS_COOLDOWN_HINT, itemCfgId: null };
  }
  const loyalty = detail.loyalty ?? 0;
  const max = detail.loyalty_max ?? 100;
  if (loyalty >= max) {
    return { ok: false, message: "忠诚已满，无需赏赐", itemCfgId: null };
  }
  if (mode === "gold") {
    const cost = estimateGoldLargessCost(detail);
    const gold = wallet.gold ?? 0;
    if (cost > 0 && gold < cost) {
      return { ok: false, message: `金币不足（约需 ${formatWalletPrice({ gold: cost })}）`, itemCfgId: null };
    }
    return { ok: true, message: "", itemCfgId: null };
  }
  const picked = itemCfgId ?? pickDefaultLargessItemCfgId(bag);
  if (!picked) {
    return { ok: false, message: "背包暂无赏赐礼道具", itemCfgId: null };
  }
  if (!LARGESS_ITEM_LOYALTY_GAIN[picked]) {
    return { ok: false, message: "所选道具不可用于赏赐", itemCfgId: picked };
  }
  if (bagStackQuantity(bag, picked) < 1) {
    return { ok: false, message: `${itemLabel(picked)} 数量不足`, itemCfgId: picked };
  }
  return { ok: true, message: "", itemCfgId: picked };
}

export function heroDetailLargessSubmitDisabled(
  submitState: UseConsumableSubmitState,
  detail: HeroDetail | null | undefined,
  bag: BagStack[],
  wallet: ResourceWallet,
  mode: HeroLargessGiftMode,
  itemCfgId: number | null,
  nextLargessAtMs: number | null | undefined,
  nowMs: number,
): boolean {
  if (useConsumableSubmitButtonsDisabled(submitState)) return true;
  const v = validateHeroDetailLargessSubmit(detail, bag, wallet, mode, itemCfgId, nextLargessAtMs, nowMs);
  return !v.ok;
}

export function heroDetailLargessSubmitLabel(submitState: UseConsumableSubmitState): string {
  return submitState === "submitting" ? USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL : HERO_DETAIL_LARGESS_SUBMIT_DEFAULT_LABEL;
}

export function formatHeroLargessSuccessStatus(
  before: HeroDetail | null | undefined,
  res: LargessHeroResult,
): string {
  const loyaltyBefore = before?.loyalty ?? res.loyalty ?? 0;
  const loyaltyAfter = res.loyalty ?? loyaltyBefore;
  const delta = res.loyalty_delta ?? loyaltyAfter - loyaltyBefore;
  const parts: string[] = [`忠诚 ${loyaltyBefore}→${loyaltyAfter}`];
  if (delta > 0) parts.push(`+${delta}`);
  if (res.gold_spent && res.gold_spent > 0) {
    parts.push(`消耗 ${formatWalletPrice({ gold: res.gold_spent })}`);
  } else if (res.item_cfg_id) {
    parts.push(`消耗 ${itemLabel(res.item_cfg_id)}×1`);
  }
  const cd = formatLargessCooldownLine(res.next_largess_at_ms, Date.now());
  if (cd) parts.push(cd);
  return `赏赐成功：${parts.join(" · ")}`;
}

export function formatHeroLargessGatewayErrorFromUnknown(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/cooldown|largess on cooldown/i.test(msg)) {
    return HERO_DETAIL_LARGESS_COOLDOWN_HINT;
  }
  if (/loyalty max/i.test(msg)) {
    return "忠诚已满，无需赏赐";
  }
  return formatPanelGatewayErrorFromUnknown("recruit", err);
}

export function renderHeroDetailLargessMarkup(
  detail: HeroDetail | null | undefined,
  bag: BagStack[],
  wallet: ResourceWallet,
  submitState: UseConsumableSubmitState,
  mode: HeroLargessGiftMode,
  selectedItemCfgId: number | null,
  nextLargessAtMs: number | null | undefined,
  nowMs: number,
): string {
  if (!detail?.hero_id) return "";
  const validation = validateHeroDetailLargessSubmit(
    detail,
    bag,
    wallet,
    mode,
    selectedItemCfgId,
    nextLargessAtMs,
    nowMs,
  );
  const disabled = heroDetailLargessSubmitDisabled(
    submitState,
    detail,
    bag,
    wallet,
    mode,
    selectedItemCfgId,
    nextLargessAtMs,
    nowMs,
  );
  const label = heroDetailLargessSubmitLabel(submitState);
  const cdLine = formatLargessCooldownLine(nextLargessAtMs, nowMs);
  const goldCost = estimateGoldLargessCost(detail);
  const goldHint =
    goldCost > 0
      ? `金币赏赐约 ${formatWalletPrice({ gold: goldCost })}（随机忠诚提升）`
      : "金币赏赐（随机忠诚提升）";
  const bagItems = filterLargessBagItemIds(bag);
  const itemOptions = LARGESS_ITEM_CFG_IDS
    .map((id) => {
      const qty = bagStackQuantity(bag, id);
      const gain = LARGESS_ITEM_LOYALTY_GAIN[id];
      const name = itemLabel(id);
      const labelText = qty > 0 ? `${name}×${qty}（+${gain}）` : `${name}（+${gain}，无库存）`;
      const selected = (selectedItemCfgId ?? pickDefaultLargessItemCfgId(bag)) === id;
      return `<option value="${id}"${selected ? " selected" : ""}${qty <= 0 ? " disabled" : ""}>${labelText}</option>`;
    })
    .join("");
  const itemHint =
    bagItems.length > 0
      ? `道具赏赐：背包 ${bagItems.length} 种礼道具可用`
      : "道具赏赐：背包暂无礼道具";
  const reason = validation.ok ? "" : validation.message;
  const goldChecked = mode === "gold" ? " checked" : "";
  const itemChecked = mode === "item" ? " checked" : "";
  return `<div class="hero-detail-largess" aria-label="将领赏赐">
    <p class="hero-largess-title">赏赐（提升忠诚）</p>
    <fieldset class="hero-largess-kind">
      <label><input type="radio" name="hero-largess-kind" value="gold" data-action="hero-largess-kind"${goldChecked} /> 金币</label>
      <label><input type="radio" name="hero-largess-kind" value="item" data-action="hero-largess-kind"${itemChecked} /> 道具礼</label>
    </fieldset>
    <p class="hero-largess-gold-hint${mode === "gold" ? "" : " hidden"}" data-role="hero-largess-gold-hint">${goldHint}</p>
    <p class="hero-largess-item-hint${mode === "item" ? "" : " hidden"}" data-role="hero-largess-item-hint">${itemHint}</p>
    <select class="hero-largess-item-select${mode === "item" ? "" : " hidden"}" data-field="hero-largess-item" aria-label="赏赐道具">
      ${itemOptions}
    </select>
    <p class="hero-largess-cd${cdLine ? "" : " hidden"}" data-role="hero-largess-cd">${cdLine}</p>
    <button type="button" data-action="hero-largess-submit"${disabled ? " disabled" : ""}>${label}</button>
    <p class="march-form-error-sibling hero-largess-disabled-reason${reason ? "" : " hidden"}" data-role="hero-largess-disabled-reason">${reason}</p>
    <p class="march-form-error-sibling hidden" data-role="hero-largess-form-error" role="alert"></p>
    <p class="hero-largess-success hidden" data-role="hero-largess-success" role="status"></p>
  </div>`;
}

export function syncHeroDetailLargessSubmitButton(
  panelRoot: ParentNode | null | undefined,
  submitState: UseConsumableSubmitState,
  detail: HeroDetail | null | undefined,
  bag: BagStack[],
  wallet: ResourceWallet,
  mode: HeroLargessGiftMode,
  itemCfgId: number | null,
  nextLargessAtMs: number | null | undefined,
  nowMs: number,
): void {
  const btn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="hero-largess-submit"]');
  if (!btn) return;
  btn.disabled = heroDetailLargessSubmitDisabled(
    submitState,
    detail,
    bag,
    wallet,
    mode,
    itemCfgId,
    nextLargessAtMs,
    nowMs,
  );
  btn.textContent = heroDetailLargessSubmitLabel(submitState);
}

export function syncHeroDetailLargessCooldownDisplay(
  panelRoot: ParentNode | null | undefined,
  nextLargessAtMs: number | null | undefined,
  nowMs: number,
): void {
  const cdEl = panelRoot?.querySelector('[data-role="hero-largess-cd"]');
  if (!cdEl) return;
  const line = formatLargessCooldownLine(nextLargessAtMs, nowMs);
  cdEl.textContent = line;
  cdEl.classList.toggle("hidden", !line);
  const reasonEl = panelRoot?.querySelector('[data-role="hero-largess-disabled-reason"]');
  if (reasonEl && line && reasonEl.classList.contains("hidden")) {
    cdEl.classList.remove("hidden");
  }
}

export function setHeroLargessFormErrorDisplay(panelRoot: ParentNode | null | undefined, message: string | null): void {
  const el = panelRoot?.querySelector('[data-role="hero-largess-form-error"]');
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

export function setHeroLargessSuccessDisplay(panelRoot: ParentNode | null | undefined, message: string | null): void {
  const el = panelRoot?.querySelector('[data-role="hero-largess-success"]');
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}
