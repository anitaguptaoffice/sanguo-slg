import type { ResourceWallet } from "@/net/bootstrapSession";
import type { HeroDetail } from "@/net/heroMailState";
import { formatPanelGatewayErrorFromUnknown } from "@/net/contentFormValidation";
import {
  HERO_STATUS_EXPR,
  HERO_STATUS_IDLE,
  formatHeroStatusLabel,
  isHeroSelectableForMarch,
} from "@/net/marchHeroPick";
import {
  USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL,
  type UseConsumableSubmitState,
  useConsumableSubmitButtonsDisabled,
} from "@/net/useConsumableSubmitFeedback";

/** 与 internal/hero/expr.go 对齐。 */
export const HERO_EXPR_HOURS_MIN = 1;
export const HERO_EXPR_HOURS_MAX = 4;
export const HERO_EXPR_HOURS_DEFAULT = 1;

const EXPR_GOLD_PER_LEVEL_HOUR = 10;
const EXPR_EXP_PER_LEVEL_HOUR = 20;

export type HeroExprBeginResult = {
  hero_id: number;
  status: number;
  ends_at_ms: number;
  gold_spent: number;
  hours: number;
};

export type HeroExprCancelResult = {
  hero_id: number;
  status: number;
};

export type HeroExprFinishResult = {
  hero_id: number;
  status: number;
  exp_gained: number;
  exp: number;
};

function numField(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function normalizeHeroExprHours(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return HERO_EXPR_HOURS_DEFAULT;
  return Math.min(HERO_EXPR_HOURS_MAX, Math.max(HERO_EXPR_HOURS_MIN, Math.floor(hours)));
}

export function heroExprGoldCost(level: number | undefined, hours: number): number {
  const lv = level ?? 1;
  const h = normalizeHeroExprHours(hours);
  return lv * h * EXPR_GOLD_PER_LEVEL_HOUR;
}

export function heroExprRewardExp(level: number | undefined, hours: number): number {
  const lv = level ?? 1;
  const h = normalizeHeroExprHours(hours);
  return lv * h * EXPR_EXP_PER_LEVEL_HOUR;
}

export function parseBeginHeroExprResponse(raw: unknown): HeroExprBeginResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    hero_id: numField(r.hero_id) ?? 0,
    status: numField(r.status) ?? HERO_STATUS_EXPR,
    ends_at_ms: numField(r.ends_at_ms) ?? 0,
    gold_spent: numField(r.gold_spent) ?? 0,
    hours: normalizeHeroExprHours(numField(r.hours) ?? HERO_EXPR_HOURS_DEFAULT),
  };
}

export function parseCancelHeroExprResponse(raw: unknown): HeroExprCancelResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    hero_id: numField(r.hero_id) ?? 0,
    status: numField(r.status) ?? HERO_STATUS_IDLE,
  };
}

export function parseHeroExprFinishResponse(raw: unknown): HeroExprFinishResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    hero_id: numField(r.hero_id) ?? 0,
    status: numField(r.status) ?? HERO_STATUS_IDLE,
    exp_gained: numField(r.exp_gained) ?? 0,
    exp: numField(r.exp) ?? 0,
  };
}

export function isHeroExprInProgress(detail: HeroDetail | null | undefined): boolean {
  if (!detail?.hero_id) return false;
  if (detail.status === HERO_STATUS_EXPR) return true;
  return (detail.expr_ends_at_ms ?? 0) > 0;
}

export function heroExprEndsAtMs(detail: HeroDetail | null | undefined): number | null {
  if (!detail?.hero_id) return null;
  const ends = detail.expr_ends_at_ms;
  if (ends != null && ends > 0) return ends;
  if (detail.status === HERO_STATUS_EXPR) return null;
  return null;
}

export function heroExprHoursOnDetail(detail: HeroDetail | null | undefined): number {
  return normalizeHeroExprHours(detail?.expr_hours ?? HERO_EXPR_HOURS_DEFAULT);
}

export function heroExprCompleteNow(detail: HeroDetail | null | undefined, nowMs: number): boolean {
  const ends = heroExprEndsAtMs(detail);
  if (ends == null) return false;
  return nowMs >= ends;
}

export function applyBeginHeroExprToDetail(
  detail: HeroDetail | null | undefined,
  res: HeroExprBeginResult,
): HeroDetail {
  const base = detail ?? { hero_id: res.hero_id };
  return {
    ...base,
    hero_id: res.hero_id,
    status: res.status,
    expr_ends_at_ms: res.ends_at_ms,
    expr_hours: res.hours,
  };
}

export function applyCancelHeroExprToDetail(
  detail: HeroDetail | null | undefined,
  res: HeroExprCancelResult,
): HeroDetail {
  const base = detail ?? { hero_id: res.hero_id };
  return {
    ...base,
    hero_id: res.hero_id,
    status: res.status,
    expr_ends_at_ms: undefined,
    expr_hours: undefined,
  };
}

export function applyHeroExprFinishToDetail(
  detail: HeroDetail | null | undefined,
  res: HeroExprFinishResult,
): HeroDetail {
  const base = detail ?? { hero_id: res.hero_id };
  return {
    ...base,
    hero_id: res.hero_id,
    status: res.status,
    exp: res.exp,
    expr_ends_at_ms: undefined,
    expr_hours: undefined,
  };
}

export type HeroExprSnapshot = Pick<HeroDetail, "status" | "expr_ends_at_ms" | "expr_hours">;

export function heroExprSnapshotFromDetail(detail: HeroDetail | null | undefined): HeroExprSnapshot | null {
  if (!detail?.hero_id) return null;
  if (!isHeroExprInProgress(detail)) return null;
  return {
    status: detail.status ?? HERO_STATUS_EXPR,
    expr_ends_at_ms: detail.expr_ends_at_ms,
    expr_hours: detail.expr_hours,
  };
}

export function mergeHeroExprSnapshot(
  detail: HeroDetail,
  snapshot: HeroExprSnapshot | null | undefined,
): HeroDetail {
  if (!snapshot) return detail;
  return {
    ...detail,
    status: snapshot.status ?? detail.status,
    expr_ends_at_ms: snapshot.expr_ends_at_ms ?? detail.expr_ends_at_ms,
    expr_hours: snapshot.expr_hours ?? detail.expr_hours,
  };
}

export function heroExprIdleRequiredReason(detail: HeroDetail | null | undefined): string | null {
  if (!detail?.hero_id) return "请先选择将领";
  if (!isHeroSelectableForMarch(detail)) {
    const label = formatHeroStatusLabel(detail.status);
    return `将领当前为「${label}」，仅空闲将领可开始历练`;
  }
  return null;
}

export function heroExprBeginDisabledReason(
  detail: HeroDetail | null | undefined,
  wallet: ResourceWallet | null | undefined,
  hours: number,
): string {
  const idle = heroExprIdleRequiredReason(detail);
  if (idle) return idle;
  const cost = heroExprGoldCost(detail?.level, hours);
  const gold = wallet?.gold ?? 0;
  if (gold < cost) return `黄金不足（需 ${cost}，当前 ${gold}）`;
  return "";
}

export function heroExprCancelDisabledReason(detail: HeroDetail | null | undefined): string {
  if (!detail?.hero_id) return "请先选择将领";
  if (!isHeroExprInProgress(detail)) return "将领未在历练中";
  return "";
}

export function heroExprFinishDisabledReason(
  detail: HeroDetail | null | undefined,
  nowMs: number,
): string {
  if (!detail?.hero_id) return "请先选择将领";
  if (!isHeroExprInProgress(detail)) return "将领未在历练中";
  if (!heroExprCompleteNow(detail, nowMs)) {
    const ends = heroExprEndsAtMs(detail);
    if (ends != null) return "历练尚未结束，可取消或加速";
    return "历练尚未结束";
  }
  return "";
}

export function heroExprFasterDisabledReason(
  detail: HeroDetail | null | undefined,
  nowMs: number,
): string {
  if (!detail?.hero_id) return "请先选择将领";
  if (!isHeroExprInProgress(detail)) return "将领未在历练中";
  if (heroExprCompleteNow(detail, nowMs)) return "历练已结束，请点完成领取";
  return "";
}

export function heroExprBeginDisabled(
  submitState: UseConsumableSubmitState,
  detail: HeroDetail | null | undefined,
  wallet: ResourceWallet | null | undefined,
  hours: number,
): boolean {
  if (useConsumableSubmitButtonsDisabled(submitState)) return true;
  if (!detail?.hero_id) return true;
  if (isHeroExprInProgress(detail)) return true;
  return heroExprBeginDisabledReason(detail, wallet, hours) !== "";
}

export function heroExprCancelDisabled(
  submitState: UseConsumableSubmitState,
  detail: HeroDetail | null | undefined,
): boolean {
  if (useConsumableSubmitButtonsDisabled(submitState)) return true;
  if (!detail?.hero_id) return true;
  return heroExprCancelDisabledReason(detail) !== "";
}

export function heroExprFinishDisabled(
  submitState: UseConsumableSubmitState,
  detail: HeroDetail | null | undefined,
  nowMs: number,
): boolean {
  if (useConsumableSubmitButtonsDisabled(submitState)) return true;
  if (!detail?.hero_id) return true;
  return heroExprFinishDisabledReason(detail, nowMs) !== "";
}

export function heroExprFasterDisabled(
  submitState: UseConsumableSubmitState,
  detail: HeroDetail | null | undefined,
  nowMs: number,
): boolean {
  if (useConsumableSubmitButtonsDisabled(submitState)) return true;
  if (!detail?.hero_id) return true;
  return heroExprFasterDisabledReason(detail, nowMs) !== "";
}

function formatDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}小时${m}分`;
  if (m > 0) return `${m}分${s}秒`;
  return `${s}秒`;
}

export function formatHeroExprStatusLine(
  detail: HeroDetail | null | undefined,
  nowMs: number,
  hoursPref: number,
  wallet?: ResourceWallet | null,
): string {
  if (!detail?.hero_id) return "";
  if (isHeroExprInProgress(detail)) {
    const ends = heroExprEndsAtMs(detail);
    const hrs = heroExprHoursOnDetail(detail);
    if (ends != null && nowMs < ends) {
      return `历练中 · ${hrs}小时 · 剩余 ${formatDurationMs(ends - nowMs)}`;
    }
    if (ends != null && nowMs >= ends) {
      return `历练已结束 · ${hrs}小时 · 可领取经验`;
    }
    return `历练中 · ${hrs}小时`;
  }
  const h = normalizeHeroExprHours(hoursPref);
  const cost = heroExprGoldCost(detail.level, h);
  const reward = heroExprRewardExp(detail.level, h);
  return `空闲可历练 · ${h}小时 · 消耗黄金 ${cost} · 预计经验 +${reward}`;
}

export function formatHeroExprBeginSuccessStatus(res: HeroExprBeginResult): string {
  return `开始历练：${res.hours}小时（消耗黄金 ${res.gold_spent}）`;
}

export function formatHeroExprCancelSuccessStatus(): string {
  return "已取消历练";
}

export function formatHeroExprFinishSuccessStatus(res: HeroExprFinishResult): string {
  return `历练完成：经验 +${res.exp_gained}`;
}

export function formatHeroExprFasterSuccessStatus(res: HeroExprFinishResult): string {
  return `加速完成历练：经验 +${res.exp_gained}`;
}

function isHeroExprNotIdleMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("not idle") || m.includes("非空闲");
}

function isHeroExprNotExprMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("not expr") || m.includes("未在历练");
}

function isHeroExprNotCompleteMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("not complete") || m.includes("尚未结束");
}

function isHeroExprInsufficientGoldMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("insufficient gold") || m.includes("黄金不足");
}

function isHeroExprInvalidHoursMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("invalid expr hours") || m.includes("历练时长");
}

/** 历练网关错误 → 中文可读。 */
export function formatHeroExprGatewayErrorFromUnknown(err: unknown): string {
  const raw = formatPanelGatewayErrorFromUnknown("recruit", err);
  const msg = raw.toLowerCase();
  if (isHeroExprNotIdleMessage(msg)) {
    return "仅空闲将领可开始历练";
  }
  if (isHeroExprInsufficientGoldMessage(msg)) {
    return "黄金不足，无法开始历练";
  }
  if (isHeroExprInvalidHoursMessage(msg)) {
    return `历练时长须为 ${HERO_EXPR_HOURS_MIN}–${HERO_EXPR_HOURS_MAX} 小时`;
  }
  if (isHeroExprNotExprMessage(msg)) {
    return "将领未在历练中";
  }
  if (isHeroExprNotCompleteMessage(msg)) {
    return "历练尚未结束，请等待或使用加速";
  }
  return raw;
}

export function renderHeroDetailExprMarkup(
  submitState: UseConsumableSubmitState,
  detail?: HeroDetail | null,
  wallet?: ResourceWallet | null,
  hoursPref?: number,
  nowMs?: number,
): string {
  if (!detail?.hero_id) return "";
  const now = nowMs ?? Date.now();
  const hours = normalizeHeroExprHours(hoursPref ?? HERO_EXPR_HOURS_DEFAULT);
  const inExpr = isHeroExprInProgress(detail);
  const summary = formatHeroExprStatusLine(detail, now, hours, wallet);
  const inflight = submitState === "submitting";
  const beginDisabled = heroExprBeginDisabled(submitState, detail, wallet, hours);
  const cancelDisabled = heroExprCancelDisabled(submitState, detail);
  const finishDisabled = heroExprFinishDisabled(submitState, detail, now);
  const fasterDisabled = heroExprFasterDisabled(submitState, detail, now);
  const beginReason = inExpr ? "" : heroExprBeginDisabledReason(detail, wallet, hours);
  const cancelReason = heroExprCancelDisabledReason(detail);
  const finishReason = heroExprFinishDisabledReason(detail, now);
  const fasterReason = heroExprFasterDisabledReason(detail, now);
  const hourButtons = Array.from({ length: HERO_EXPR_HOURS_MAX }, (_, i) => i + 1)
    .map((h) => {
      const selected = h === hours;
      const disabled = inExpr || inflight;
      return `<button type="button" class="hero-expr-hours-btn${selected ? " hero-expr-hours-selected" : ""}" data-action="hero-expr-hours" data-hours="${h}"${disabled ? " disabled" : ""} aria-pressed="${selected}">${h}h</button>`;
    })
    .join("");
  const showBeginReason = beginReason && beginDisabled && !inflight;
  const showCancelReason = cancelReason && cancelDisabled && !inflight;
  const showFinishReason = finishReason && finishDisabled && !inflight && inExpr;
  const showFasterReason = fasterReason && fasterDisabled && !inflight && inExpr;
  const beginLabel = inflight ? USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL : "开始历练";
  const cancelLabel = inflight ? USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL : "取消历练";
  const finishLabel = inflight ? USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL : "完成历练";
  const fasterLabel = inflight ? USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL : "加速完成";
  return `<section class="hero-detail-expr" aria-label="将领历练">
    <p class="hero-expr-summary" data-role="hero-expr-summary">${summary}</p>
    <div class="hero-expr-hours-row" data-role="hero-expr-hours-row">${hourButtons}</div>
    <div class="hero-expr-action-row">
      <button type="button" data-action="hero-expr-begin"${beginDisabled || inExpr ? " disabled" : ""}>${beginLabel}</button>
      <button type="button" data-action="hero-expr-cancel"${cancelDisabled || !inExpr ? " disabled" : ""}>${cancelLabel}</button>
      <button type="button" data-action="hero-expr-finish"${finishDisabled || !inExpr ? " disabled" : ""}>${finishLabel}</button>
      <button type="button" data-action="hero-expr-faster"${fasterDisabled || !inExpr ? " disabled" : ""}>${fasterLabel}</button>
    </div>
    <p class="march-form-error-sibling hero-expr-disabled-reason${showBeginReason ? "" : " hidden"}" data-role="hero-expr-begin-disabled-reason">${beginReason}</p>
    <p class="march-form-error-sibling hero-expr-disabled-reason${showCancelReason ? "" : " hidden"}" data-role="hero-expr-cancel-disabled-reason">${cancelReason}</p>
    <p class="march-form-error-sibling hero-expr-disabled-reason${showFinishReason ? "" : " hidden"}" data-role="hero-expr-finish-disabled-reason">${finishReason}</p>
    <p class="march-form-error-sibling hero-expr-disabled-reason${showFasterReason ? "" : " hidden"}" data-role="hero-expr-faster-disabled-reason">${fasterReason}</p>
    <p class="march-form-error-sibling hidden" data-role="hero-expr-form-error" role="alert"></p>
    <p class="hero-expr-success hidden" data-role="hero-expr-success" role="status"></p>
  </section>`;
}

export function setHeroExprFormErrorDisplay(
  panelRoot: ParentNode | null | undefined,
  message: string | null,
): void {
  const el = panelRoot?.querySelector('[data-role="hero-expr-form-error"]');
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

export function setHeroExprSuccessDisplay(
  panelRoot: ParentNode | null | undefined,
  message: string | null,
): void {
  const el = panelRoot?.querySelector('[data-role="hero-expr-success"]');
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

export function syncHeroDetailExprControls(
  panelRoot: ParentNode | null | undefined,
  submitState: UseConsumableSubmitState,
  detail?: HeroDetail | null,
  wallet?: ResourceWallet | null,
  hoursPref?: number,
  nowMs?: number,
): void {
  const now = nowMs ?? Date.now();
  const hours = normalizeHeroExprHours(hoursPref ?? HERO_EXPR_HOURS_DEFAULT);
  const inExpr = isHeroExprInProgress(detail);
  const summaryEl = panelRoot?.querySelector('[data-role="hero-expr-summary"]');
  if (summaryEl) summaryEl.textContent = formatHeroExprStatusLine(detail, now, hours, wallet);
  panelRoot?.querySelectorAll<HTMLButtonElement>('[data-action="hero-expr-hours"]').forEach((btn) => {
    const h = Number(btn.dataset.hours);
    const selected = h === hours;
    btn.disabled = inExpr || submitState === "submitting";
    btn.classList.toggle("hero-expr-hours-selected", selected);
    btn.setAttribute("aria-pressed", String(selected));
  });
  const beginBtn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="hero-expr-begin"]');
  if (beginBtn) {
    beginBtn.disabled = heroExprBeginDisabled(submitState, detail, wallet, hours) || inExpr;
    beginBtn.textContent =
      submitState === "submitting" ? USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL : "开始历练";
  }
  const cancelBtn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="hero-expr-cancel"]');
  if (cancelBtn) {
    cancelBtn.disabled = heroExprCancelDisabled(submitState, detail) || !inExpr;
    cancelBtn.textContent =
      submitState === "submitting" ? USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL : "取消历练";
  }
  const finishBtn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="hero-expr-finish"]');
  if (finishBtn) {
    finishBtn.disabled = heroExprFinishDisabled(submitState, detail, now) || !inExpr;
    finishBtn.textContent =
      submitState === "submitting" ? USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL : "完成历练";
  }
  const fasterBtn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="hero-expr-faster"]');
  if (fasterBtn) {
    fasterBtn.disabled = heroExprFasterDisabled(submitState, detail, now) || !inExpr;
    fasterBtn.textContent =
      submitState === "submitting" ? USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL : "加速完成";
  }
  const setReason = (role: string, reason: string, disabled: boolean) => {
    const el = panelRoot?.querySelector(`[data-role="${role}"]`);
    if (!el) return;
    const show = reason && disabled && submitState !== "submitting";
    el.textContent = reason;
    el.classList.toggle("hidden", !show);
  };
  setReason(
    "hero-expr-begin-disabled-reason",
    inExpr ? "" : heroExprBeginDisabledReason(detail, wallet, hours),
    beginBtn?.disabled ?? true,
  );
  setReason("hero-expr-cancel-disabled-reason", heroExprCancelDisabledReason(detail), cancelBtn?.disabled ?? true);
  setReason(
    "hero-expr-finish-disabled-reason",
    heroExprFinishDisabledReason(detail, now),
    finishBtn?.disabled ?? true,
  );
  setReason(
    "hero-expr-faster-disabled-reason",
    heroExprFasterDisabledReason(detail, now),
    fasterBtn?.disabled ?? true,
  );
}
