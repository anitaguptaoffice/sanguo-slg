import type { HeroDetail } from "@/net/heroMailState";
import { formatPanelGatewayErrorFromUnknown } from "@/net/contentFormValidation";
import { HERO_STATUS_IDLE, formatHeroStatusLabel, isHeroSelectableForMarch } from "@/net/marchHeroPick";
import { readHeroMarchForceSession, writeHeroMarchForceSession } from "@/net/heroMarchForceSession";
import {
  USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL,
  type UseConsumableSubmitState,
  useConsumableSubmitButtonsDisabled,
} from "@/net/useConsumableSubmitFeedback";

/** 与 internal/hero/march_force.go MarchForceMarchCost 对齐。 */
export const HERO_MARCH_FORCE_MARCH_COST = 10;

/** 与 internal/hero/march_force.go MarchForceMax 对齐（无网关 max 时降级）。 */
export function heroMarchForceMaxFromLevel(level: number | undefined): number {
  const lv = level != null && level >= 1 ? level : 1;
  const max = 20 + lv * 4;
  return max > 100 ? 100 : max;
}

function numField(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export type HeroRestForceResult = {
  hero_id: number;
  march_force?: number;
  march_force_max?: number;
};

export function parseRestHeroResponse(raw: unknown): HeroRestForceResult {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    hero_id: numField(r.hero_id) ?? 0,
    march_force: numField(r.march_force ?? r.marchForce),
    march_force_max: numField(r.march_force_max ?? r.marchForceMax),
  };
}

export function heroMarchForceCurrent(detail: HeroDetail | null | undefined): number | undefined {
  return detail?.march_force;
}

export function heroMarchForceMax(detail: HeroDetail | null | undefined): number {
  if (detail?.march_force_max != null) return detail.march_force_max;
  return heroMarchForceMaxFromLevel(detail?.level);
}

export function heroMarchForcePercent(detail: HeroDetail | null | undefined): number {
  const max = heroMarchForceMax(detail);
  if (max <= 0) return 0;
  const cur = detail?.march_force ?? 0;
  return Math.min(100, Math.max(0, Math.round((cur / max) * 100)));
}

export function applyRestHeroToDetail(
  detail: HeroDetail | null | undefined,
  res: HeroRestForceResult,
): HeroDetail {
  const base = detail ?? { hero_id: res.hero_id };
  const max = res.march_force_max ?? heroMarchForceMax(base);
  return {
    ...base,
    hero_id: res.hero_id,
    march_force: res.march_force ?? max,
    march_force_max: max,
  };
}

export function formatHeroMarchForceSummary(detail: HeroDetail | null | undefined): string {
  if (!detail?.hero_id) return "";
  const max = heroMarchForceMax(detail);
  const cur = detail.march_force ?? 0;
  return `出征体力 ${cur}/${max}（单次出征消耗 ${HERO_MARCH_FORCE_MARCH_COST}）`;
}

export function heroRestIdleRequiredReason(detail: HeroDetail | null | undefined): string | null {
  if (!detail?.hero_id) return "请先选择将领";
  if (!isHeroSelectableForMarch(detail)) {
    const label = formatHeroStatusLabel(detail.status);
    return `将领当前为「${label}」，仅空闲将领可休整回满`;
  }
  return null;
}

export function heroRestDisabledReason(detail: HeroDetail | null | undefined): string {
  const idle = heroRestIdleRequiredReason(detail);
  if (idle) return idle;
  if (detail?.march_force == null) return "";
  const max = heroMarchForceMax(detail);
  if (detail.march_force >= max) return "出征体力已满，无需休整";
  return "";
}

export function heroRestDisabled(
  submitState: UseConsumableSubmitState,
  detail: HeroDetail | null | undefined,
): boolean {
  if (useConsumableSubmitButtonsDisabled(submitState)) return true;
  if (!detail?.hero_id) return true;
  return heroRestDisabledReason(detail) !== "";
}

export function formatHeroRestSuccessStatus(detail: HeroDetail | null | undefined): string {
  const max = heroMarchForceMax(detail);
  return `休整成功：出征体力已回满（${max}/${max}）`;
}

function isHeroNotInCityMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("not in city") || m.includes("不在城") || m.includes("hero: hero not in city");
}

/** RestHero 网关错误 → 中文可读。 */
export function formatHeroForceGatewayErrorFromUnknown(err: unknown): string {
  const raw = formatPanelGatewayErrorFromUnknown("recruit", err);
  const msg = raw.toLowerCase();
  if (isHeroNotInCityMessage(msg)) {
    return "仅空闲且在城中的将领可休整回满体力";
  }
  return raw;
}

export function persistHeroMarchForceFromDetail(detail: HeroDetail | null | undefined): void {
  if (!detail?.hero_id) return;
  if (detail.march_force == null && detail.march_force_max == null) return;
  const max = heroMarchForceMax(detail);
  const cur = detail.march_force ?? max;
  writeHeroMarchForceSession(detail.hero_id, cur, max);
}

export function validateMarchHeroMarchForce(
  heroId: number,
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): { ok: true } | { ok: false; message: string } {
  const snap = readHeroMarchForceSession(heroId, storage);
  if (!snap) return { ok: true };
  if (snap.current < HERO_MARCH_FORCE_MARCH_COST) {
    return {
      ok: false,
      message: `将领出征体力不足（当前 ${snap.current}/${snap.max}，出征需 ${HERO_MARCH_FORCE_MARCH_COST}）`,
    };
  }
  return { ok: true };
}

export function renderHeroDetailForceMarkup(
  submitState: UseConsumableSubmitState,
  detail?: HeroDetail | null,
): string {
  if (!detail?.hero_id) return "";
  const summary = formatHeroMarchForceSummary(detail);
  const pct = heroMarchForcePercent(detail);
  const restDisabled = heroRestDisabled(submitState, detail);
  const restReason = heroRestDisabledReason(detail);
  const inflight = submitState === "submitting";
  const restLabel = inflight ? USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL : "休整回满";
  const showRestReason = restReason && restDisabled && !inflight;
  return `<section class="hero-detail-force" aria-label="出征体力">
    <p class="hero-force-summary" data-role="hero-force-summary">${summary}</p>
    <p class="hero-force-bar" data-role="hero-force-bar" aria-hidden="true"><span class="hero-force-bar-fill" style="width:${pct}%"></span></p>
    <button type="button" data-action="hero-force-rest"${restDisabled ? " disabled" : ""}>${restLabel}</button>
    <p class="march-form-error-sibling hero-force-disabled-reason${showRestReason ? "" : " hidden"}" data-role="hero-force-rest-disabled-reason">${restReason}</p>
    <p class="march-form-error-sibling hidden" data-role="hero-force-form-error" role="alert"></p>
    <p class="hero-force-success hidden" data-role="hero-force-success" role="status"></p>
  </section>`;
}

export function setHeroForceFormErrorDisplay(
  panelRoot: ParentNode | null | undefined,
  message: string | null,
): void {
  const el = panelRoot?.querySelector('[data-role="hero-force-form-error"]');
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

export function setHeroForceSuccessDisplay(
  panelRoot: ParentNode | null | undefined,
  message: string | null,
): void {
  const el = panelRoot?.querySelector('[data-role="hero-force-success"]');
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

export function syncHeroDetailForceControls(
  panelRoot: ParentNode | null | undefined,
  submitState: UseConsumableSubmitState,
  detail?: HeroDetail | null,
): void {
  const summaryEl = panelRoot?.querySelector('[data-role="hero-force-summary"]');
  if (summaryEl) summaryEl.textContent = formatHeroMarchForceSummary(detail);
  const barFill = panelRoot?.querySelector<HTMLElement>(".hero-force-bar-fill");
  if (barFill) barFill.style.width = `${heroMarchForcePercent(detail)}%`;
  const restBtn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="hero-force-rest"]');
  if (restBtn) {
    restBtn.disabled = heroRestDisabled(submitState, detail);
    restBtn.textContent =
      submitState === "submitting" ? USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL : "休整回满";
  }
  const reasonEl = panelRoot?.querySelector('[data-role="hero-force-rest-disabled-reason"]');
  if (reasonEl) {
    const reason = heroRestDisabledReason(detail) ?? "";
    const show = reason && (restBtn?.disabled ?? true) && submitState !== "submitting";
    reasonEl.textContent = reason;
    reasonEl.classList.toggle("hidden", !show);
  }
}
