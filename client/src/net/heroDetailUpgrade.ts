import type { HeroAttributes, HeroDetail } from "@/net/heroMailState";
import { formatPanelGatewayErrorFromUnknown } from "@/net/contentFormValidation";
import {
  USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL,
  type UseConsumableSubmitState,
  useConsumableSubmitButtonsDisabled,
} from "@/net/useConsumableSubmitFeedback";

/** 与 internal/hero/types.go MaxLevelM1 对齐（M1 等级上限，本卡不扩 cap）。 */
export const HERO_MAX_LEVEL_M1 = 20;

export const HERO_DETAIL_UPGRADE_DEFAULT_LABEL = "升级";
export const HERO_DETAIL_UPGRADE_INFLIGHT_LABEL = "升级中…";

export type UpgradeHeroResult = {
  hero_id: number;
  level: number;
  exp: number;
  previous_level: number;
  exp_current: number;
  exp_to_next: number;
  attributes?: HeroAttributes;
};

function numField(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** 将 hero.v1.UpgradeHeroResponse 规范为客户端详情字段。 */
export function parseUpgradeHeroResponse(raw: unknown): UpgradeHeroResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  const attrsRaw = r.attributes as Record<string, unknown> | null | undefined;
  const attributes =
    attrsRaw && typeof attrsRaw === "object"
      ? {
          force: numField(attrsRaw.force),
          intel: numField(attrsRaw.intel),
          politics: numField(attrsRaw.politics),
          command: numField(attrsRaw.command),
        }
      : undefined;
  const heroId = numField(r.hero_id) ?? 0;
  const level = numField(r.level) ?? 1;
  const expToward = numField(r.exp_toward_next) ?? 0;
  const upgradeReq = numField(r.upgrade_exp_required) ?? 0;
  return {
    hero_id: heroId,
    level,
    exp: numField(r.exp) ?? 0,
    previous_level: numField(r.previous_level) ?? level,
    exp_current: expToward,
    exp_to_next: upgradeReq,
    attributes,
  };
}

/** 用升级响应刷新详情区 level/exp/属性（保留模板名等既有字段）。 */
export function applyUpgradeHeroToDetail(
  detail: HeroDetail | null | undefined,
  res: UpgradeHeroResult,
): HeroDetail {
  const base = detail ?? { hero_id: res.hero_id };
  return {
    ...base,
    hero_id: res.hero_id,
    level: res.level,
    exp: res.exp,
    exp_current: res.exp_current,
    exp_to_next: res.exp_to_next,
    attributes: res.attributes ?? base.attributes,
  };
}

export function heroUpgradeInsufficientExpReason(detail: HeroDetail | null | undefined): string | null {
  if (!detail?.hero_id) return null;
  const level = detail.level ?? 1;
  if (level >= HERO_MAX_LEVEL_M1) return null;
  const req = detail.exp_to_next;
  const cur = detail.exp_current;
  if (req == null || req <= 0 || cur == null) return null;
  if (cur < req) return `经验不足（${cur}/${req}）`;
  return null;
}

export function heroUpgradeDisabledReason(detail: HeroDetail | null | undefined): string | null {
  if (!detail?.hero_id) return "请先选择将领";
  const level = detail.level ?? 1;
  if (level >= HERO_MAX_LEVEL_M1) return `已达等级上限（Lv${HERO_MAX_LEVEL_M1}）`;
  const req = detail.exp_to_next;
  if (req === 0) return `已达等级上限（Lv${HERO_MAX_LEVEL_M1}）`;
  return heroUpgradeInsufficientExpReason(detail);
}

export function heroUpgradeButtonDisabled(
  submitState: UseConsumableSubmitState,
  detail: HeroDetail | null | undefined,
): boolean {
  if (useConsumableSubmitButtonsDisabled(submitState)) return true;
  if (!detail?.hero_id) return true;
  return heroUpgradeDisabledReason(detail) != null;
}

export function heroUpgradeButtonLabel(submitState: UseConsumableSubmitState): string {
  return submitState === "submitting" ? HERO_DETAIL_UPGRADE_INFLIGHT_LABEL : HERO_DETAIL_UPGRADE_DEFAULT_LABEL;
}

export function formatHeroUpgradeSuccessStatus(
  before: HeroDetail | null | undefined,
  after: HeroDetail,
): string {
  const prev = before?.level ?? after.level ?? 1;
  const next = after.level ?? prev;
  if (next > prev) {
    return `升级成功：Lv${prev}→Lv${next}`;
  }
  return `升级成功：Lv${next}`;
}

function isHeroUpgradeMaxLevelMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("max level") || m.includes("等级上限") || m.includes("已满");
}

function isHeroUpgradeInsufficientExpMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("insufficient exp") || m.includes("经验不足");
}

/** 将领升级网关错误 → 中文可读（满级 / 经验不足优先）。 */
export function formatHeroUpgradeGatewayErrorFromUnknown(err: unknown): string {
  const raw = formatPanelGatewayErrorFromUnknown("recruit", err);
  const msg = raw.toLowerCase();
  if (isHeroUpgradeMaxLevelMessage(msg)) {
    return `已达等级上限（Lv${HERO_MAX_LEVEL_M1}）`;
  }
  if (isHeroUpgradeInsufficientExpMessage(msg)) {
    return "经验不足，无法升级";
  }
  return raw;
}

export function renderHeroDetailUpgradeMarkup(
  submitState: UseConsumableSubmitState,
  detail?: HeroDetail | null,
): string {
  const disabled = heroUpgradeButtonDisabled(submitState, detail);
  const label = heroUpgradeButtonLabel(submitState);
  const reason = heroUpgradeDisabledReason(detail) ?? "";
  const showReason = reason && disabled && submitState !== "submitting";
  return `<div class="hero-detail-upgrade" aria-label="将领升级">
    <button type="button" data-action="hero-upgrade"${disabled ? " disabled" : ""}>${label}</button>
    <p class="march-form-error-sibling hero-upgrade-disabled-reason${showReason ? "" : " hidden"}" data-role="hero-upgrade-disabled-reason">${reason}</p>
    <p class="march-form-error-sibling hidden" data-role="hero-upgrade-form-error" role="alert"></p>
    <p class="hero-upgrade-success hidden" data-role="hero-upgrade-success" role="status"></p>
  </div>`;
}

export function setHeroUpgradeFormErrorDisplay(
  panelRoot: ParentNode | null | undefined,
  message: string | null,
): void {
  const el = panelRoot?.querySelector('[data-role="hero-upgrade-form-error"]');
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

export function setHeroUpgradeSuccessDisplay(
  panelRoot: ParentNode | null | undefined,
  message: string | null,
): void {
  const el = panelRoot?.querySelector('[data-role="hero-upgrade-success"]');
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

export function syncHeroDetailUpgradeButton(
  panelRoot: ParentNode | null | undefined,
  submitState: UseConsumableSubmitState,
  detail?: HeroDetail | null,
): void {
  const btn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="hero-upgrade"]');
  if (!btn) return;
  btn.disabled = heroUpgradeButtonDisabled(submitState, detail);
  btn.textContent = heroUpgradeButtonLabel(submitState);
  const reasonEl = panelRoot?.querySelector('[data-role="hero-upgrade-disabled-reason"]');
  if (reasonEl) {
    const reason = heroUpgradeDisabledReason(detail) ?? "";
    const show = reason && btn.disabled && submitState !== "submitting";
    reasonEl.textContent = reason;
    reasonEl.classList.toggle("hidden", !show);
  }
}
