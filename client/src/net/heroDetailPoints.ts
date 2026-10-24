import type { HeroAttributes, HeroDetail } from "@/net/heroMailState";
import { formatPanelGatewayErrorFromUnknown } from "@/net/contentFormValidation";
import { HERO_STATUS_IDLE, formatHeroStatusLabel, isHeroSelectableForMarch } from "@/net/marchHeroPick";
import {
  USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL,
  type UseConsumableSubmitState,
  useConsumableSubmitButtonsDisabled,
} from "@/net/useConsumableSubmitFeedback";

/** 与 internal/hero/points.go PointBudget 对齐（M1：潜力池 = level）。 */
export function heroPointBudget(level: number | undefined): number {
  const lv = level ?? 1;
  return lv < 0 ? 0 : lv;
}

export type HeroPointAllocStat = "force" | "intel" | "politics";

export const HERO_POINT_STAT_LABEL: Record<HeroPointAllocStat, string> = {
  force: "武力",
  intel: "智力",
  politics: "政治",
};

export type HeroPointResult = {
  hero_id: number;
  potential_remaining: number;
  force_add: number;
  intel_add: number;
  politics_add: number;
  attributes?: HeroAttributes;
};

function numField(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** 将 hero.v1.AddHeroPointResponse / ClearHeroPointResponse 规范为客户端字段。 */
export function parseHeroPointResponse(raw: unknown): HeroPointResult {
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
  return {
    hero_id: numField(r.hero_id) ?? 0,
    potential_remaining: numField(r.potential_remaining) ?? 0,
    force_add: numField(r.force_add) ?? 0,
    intel_add: numField(r.intel_add) ?? 0,
    politics_add: numField(r.politics_add) ?? 0,
    attributes,
  };
}

export function heroPointUsed(detail: HeroDetail | null | undefined): number {
  if (!detail) return 0;
  const f = detail.force_add ?? 0;
  const i = detail.intel_add ?? 0;
  const p = detail.politics_add ?? 0;
  return f + i + p;
}

export function heroPointRemaining(detail: HeroDetail | null | undefined): number {
  if (!detail?.hero_id) return 0;
  if (detail.potential_remaining != null) return Math.max(0, detail.potential_remaining);
  const budget = heroPointBudget(detail.level);
  return Math.max(0, budget - heroPointUsed(detail));
}

export function applyHeroPointResultToDetail(
  detail: HeroDetail | null | undefined,
  res: HeroPointResult,
): HeroDetail {
  const base = detail ?? { hero_id: res.hero_id };
  return {
    ...base,
    hero_id: res.hero_id,
    potential_remaining: res.potential_remaining,
    force_add: res.force_add,
    intel_add: res.intel_add,
    politics_add: res.politics_add,
    attributes: res.attributes ?? base.attributes,
  };
}

/** 详情加载后合并会话内已知的潜力快照（GetHeroDetail 不下发 adds）。 */
export function mergeHeroPointSnapshot(
  detail: HeroDetail,
  snapshot: Pick<HeroDetail, "potential_remaining" | "force_add" | "intel_add" | "politics_add"> | null | undefined,
): HeroDetail {
  if (!snapshot) {
    const budget = heroPointBudget(detail.level);
    return {
      ...detail,
      force_add: detail.force_add ?? 0,
      intel_add: detail.intel_add ?? 0,
      politics_add: detail.politics_add ?? 0,
      potential_remaining: detail.potential_remaining ?? budget,
    };
  }
  return {
    ...detail,
    force_add: snapshot.force_add ?? detail.force_add ?? 0,
    intel_add: snapshot.intel_add ?? detail.intel_add ?? 0,
    politics_add: snapshot.politics_add ?? detail.politics_add ?? 0,
    potential_remaining: snapshot.potential_remaining ?? detail.potential_remaining,
  };
}

export function heroPointSnapshotFromDetail(
  detail: HeroDetail | null | undefined,
): Pick<HeroDetail, "potential_remaining" | "force_add" | "intel_add" | "politics_add"> | null {
  if (!detail?.hero_id) return null;
  return {
    potential_remaining: heroPointRemaining(detail),
    force_add: detail.force_add ?? 0,
    intel_add: detail.intel_add ?? 0,
    politics_add: detail.politics_add ?? 0,
  };
}

export function heroPointIdleRequiredReason(detail: HeroDetail | null | undefined): string | null {
  if (!detail?.hero_id) return "请先选择将领";
  if (!isHeroSelectableForMarch(detail)) {
    const label = formatHeroStatusLabel(detail.status);
    return `将领当前为「${label}」，仅空闲将领可分配潜力`;
  }
  return null;
}

export function buildAddHeroPointTargets(
  detail: HeroDetail,
  stat: HeroPointAllocStat,
): { force: number; intel: number; politics: number } {
  const attrs = detail.attributes ?? {};
  const force = attrs.force ?? 0;
  const intel = attrs.intel ?? 0;
  const politics = attrs.politics ?? 0;
  if (stat === "force") return { force: force + 1, intel, politics };
  if (stat === "intel") return { force, intel: intel + 1, politics };
  return { force, intel, politics: politics + 1 };
}

export function heroPointAddDisabled(
  submitState: UseConsumableSubmitState,
  detail: HeroDetail | null | undefined,
): boolean {
  if (useConsumableSubmitButtonsDisabled(submitState)) return true;
  if (!detail?.hero_id) return true;
  if (heroPointIdleRequiredReason(detail) != null) return true;
  return heroPointRemaining(detail) <= 0;
}

export function heroPointClearDisabled(
  submitState: UseConsumableSubmitState,
  detail: HeroDetail | null | undefined,
): boolean {
  if (useConsumableSubmitButtonsDisabled(submitState)) return true;
  if (!detail?.hero_id) return true;
  if (heroPointIdleRequiredReason(detail) != null) return true;
  return heroPointUsed(detail) <= 0;
}

export function heroPointAddDisabledReason(detail: HeroDetail | null | undefined): string {
  const idle = heroPointIdleRequiredReason(detail);
  if (idle) return idle;
  if (heroPointRemaining(detail) <= 0) return "潜力点已用尽";
  return "";
}

export function heroPointClearDisabledReason(detail: HeroDetail | null | undefined): string {
  const idle = heroPointIdleRequiredReason(detail);
  if (idle) return idle;
  if (heroPointUsed(detail) <= 0) return "尚未分配潜力点";
  return "";
}

export function formatHeroPointAllocSummary(detail: HeroDetail | null | undefined): string {
  if (!detail?.hero_id) return "";
  const rem = heroPointRemaining(detail);
  const budget = heroPointBudget(detail.level);
  const f = detail.force_add ?? 0;
  const i = detail.intel_add ?? 0;
  const p = detail.politics_add ?? 0;
  return `潜力 剩余 ${rem}/${budget} · 已加 武+${f} 智+${i} 政+${p}`;
}

export function formatHeroPointAddSuccessStatus(stat: HeroPointAllocStat): string {
  return `加点成功：${HERO_POINT_STAT_LABEL[stat]}+1`;
}

export function formatHeroPointClearSuccessStatus(detail: HeroDetail | null | undefined): string {
  const budget = heroPointBudget(detail?.level);
  return `洗点成功：潜力已重置（${budget} 点可分配）`;
}

function isHeroPointInsufficientMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("insufficient potential") || m.includes("潜力不足");
}

function isHeroPointInvalidTargetsMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("invalid point") || m.includes("不可下调");
}

function isHeroNotInCityMessage(msg: string): boolean {
  const m = msg.toLowerCase();
  return m.includes("not in city") || m.includes("不在城") || m.includes("hero: hero not in city");
}

/** 潜力加点/洗点网关错误 → 中文可读。 */
export function formatHeroPointGatewayErrorFromUnknown(err: unknown): string {
  const raw = formatPanelGatewayErrorFromUnknown("recruit", err);
  const msg = raw.toLowerCase();
  if (isHeroNotInCityMessage(msg)) {
    return "仅空闲且在城中的将领可分配或洗点潜力";
  }
  if (isHeroPointInsufficientMessage(msg)) {
    return "潜力点不足，无法继续加点";
  }
  if (isHeroPointInvalidTargetsMessage(msg)) {
    return "加点目标无效（不可下调已分配点数）";
  }
  return raw;
}

export function renderHeroDetailPointsMarkup(
  submitState: UseConsumableSubmitState,
  detail?: HeroDetail | null,
): string {
  if (!detail?.hero_id) return "";
  const summary = formatHeroPointAllocSummary(detail);
  const addDisabled = heroPointAddDisabled(submitState, detail);
  const clearDisabled = heroPointClearDisabled(submitState, detail);
  const addReason = heroPointAddDisabledReason(detail);
  const clearReason = heroPointClearDisabledReason(detail);
  const inflight = submitState === "submitting";
  const addBtnLabel = inflight ? USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL : "+1";
  const clearBtnLabel = inflight ? USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL : "洗点";
  const statButtons = (["force", "intel", "politics"] as HeroPointAllocStat[])
    .map((stat) => {
      const label = HERO_POINT_STAT_LABEL[stat];
      return `<button type="button" class="hero-point-add-btn" data-action="hero-point-add" data-stat="${stat}"${addDisabled ? " disabled" : ""} aria-label="${label}潜力+1">${label} ${addBtnLabel}</button>`;
    })
    .join("");
  const showAddReason = addReason && addDisabled && !inflight;
  const showClearReason = clearReason && clearDisabled && !inflight;
  return `<section class="hero-detail-points" aria-label="潜力加点">
    <p class="hero-point-summary" data-role="hero-point-summary">${summary}</p>
    <div class="hero-point-add-row">${statButtons}</div>
    <p class="march-form-error-sibling hero-point-disabled-reason${showAddReason ? "" : " hidden"}" data-role="hero-point-add-disabled-reason">${addReason}</p>
    <button type="button" data-action="hero-point-clear"${clearDisabled ? " disabled" : ""}>${clearBtnLabel}</button>
    <p class="march-form-error-sibling hero-point-disabled-reason${showClearReason ? "" : " hidden"}" data-role="hero-point-clear-disabled-reason">${clearReason}</p>
    <p class="march-form-error-sibling hidden" data-role="hero-point-form-error" role="alert"></p>
    <p class="hero-point-success hidden" data-role="hero-point-success" role="status"></p>
  </section>`;
}

export function setHeroPointFormErrorDisplay(
  panelRoot: ParentNode | null | undefined,
  message: string | null,
): void {
  const el = panelRoot?.querySelector('[data-role="hero-point-form-error"]');
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

export function setHeroPointSuccessDisplay(
  panelRoot: ParentNode | null | undefined,
  message: string | null,
): void {
  const el = panelRoot?.querySelector('[data-role="hero-point-success"]');
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

export function syncHeroDetailPointsControls(
  panelRoot: ParentNode | null | undefined,
  submitState: UseConsumableSubmitState,
  detail?: HeroDetail | null,
): void {
  const summaryEl = panelRoot?.querySelector('[data-role="hero-point-summary"]');
  if (summaryEl) summaryEl.textContent = formatHeroPointAllocSummary(detail);
  const addDisabled = heroPointAddDisabled(submitState, detail);
  const clearDisabled = heroPointClearDisabled(submitState, detail);
  panelRoot?.querySelectorAll<HTMLButtonElement>('[data-action="hero-point-add"]').forEach((btn) => {
    btn.disabled = addDisabled;
    const stat = btn.dataset.stat as HeroPointAllocStat | undefined;
    const label = stat ? HERO_POINT_STAT_LABEL[stat] : "";
    btn.textContent =
      submitState === "submitting" ? USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL : `${label} +1`;
  });
  const clearBtn = panelRoot?.querySelector<HTMLButtonElement>('[data-action="hero-point-clear"]');
  if (clearBtn) {
    clearBtn.disabled = clearDisabled;
    clearBtn.textContent =
      submitState === "submitting" ? USE_CONSUMABLE_SUBMIT_INFLIGHT_LABEL : "洗点";
  }
  const addReasonEl = panelRoot?.querySelector('[data-role="hero-point-add-disabled-reason"]');
  if (addReasonEl) {
    const reason = heroPointAddDisabledReason(detail) ?? "";
    const show = reason && addDisabled && submitState !== "submitting";
    addReasonEl.textContent = reason;
    addReasonEl.classList.toggle("hidden", !show);
  }
  const clearReasonEl = panelRoot?.querySelector('[data-role="hero-point-clear-disabled-reason"]');
  if (clearReasonEl) {
    const reason = heroPointClearDisabledReason(detail) ?? "";
    const show = reason && clearDisabled && submitState !== "submitting";
    clearReasonEl.textContent = reason;
    clearReasonEl.classList.toggle("hidden", !show);
  }
}
