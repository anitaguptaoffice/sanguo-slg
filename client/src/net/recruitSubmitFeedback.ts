import type { ResourceWallet } from "@/net/bootstrapSession";
import {
  formatRecruitSuccessStatus,
  type RecruitHeroResult,
  type RecruitTemplatePreview,
} from "@/net/heroMailState";

/** 招募主按钮默认文案（CLIENT-098）。 */
export const RECRUIT_SUBMIT_DEFAULT_LABEL = "招募";
/** RecruitHero 网关往返期间主按钮文案。 */
export const RECRUIT_SUBMIT_INFLIGHT_LABEL = "提交中…";
export const RECRUIT_OPEN_DETAIL_LABEL = "打开详情";

export type RecruitSubmitPhase = "idle" | "inflight" | "success" | "error";

const MATERIAL_WALLET_KEYS: (keyof ResourceWallet)[] = ["food", "wood", "iron", "stone"];

/** 招募提交流程阶段（单测覆盖 success / error / inflight 状态机）。 */
export function resolveRecruitSubmitPhase(opts: {
  inflight: boolean;
  lastError: string | null;
  lastSuccessHeroId: number | null;
}): RecruitSubmitPhase {
  if (opts.inflight) return "inflight";
  if (opts.lastError?.trim()) return "error";
  if (opts.lastSuccessHeroId != null && opts.lastSuccessHeroId > 0) return "success";
  return "idle";
}

export function recruitSubmitButtonDisabled(phase: RecruitSubmitPhase, canAfford: boolean): boolean {
  if (phase === "inflight") return true;
  return !canAfford;
}

export function recruitSubmitButtonLabel(phase: RecruitSubmitPhase): string {
  return phase === "inflight" ? RECRUIT_SUBMIT_INFLIGHT_LABEL : RECRUIT_SUBMIT_DEFAULT_LABEL;
}

/** 将领面板招募主按钮 disabled / 文案（`data-action="recruit-hero"`）。 */
export function syncRecruitSubmitButton(
  formRoot: ParentNode | null | undefined,
  phase: RecruitSubmitPhase,
  canAfford: boolean,
): void {
  const btn = formRoot?.querySelector<HTMLButtonElement>('button[data-action="recruit-hero"]');
  if (!btn) return;
  btn.disabled = recruitSubmitButtonDisabled(phase, canAfford);
  btn.textContent = recruitSubmitButtonLabel(phase);
}

/** 招募扣费涉及的四资源且钱包确实下降时，触发 CLIENT-051 顶栏脉冲。 */
export function walletMaterialDeductPulseKeys(
  before: ResourceWallet | undefined,
  after: ResourceWallet | undefined,
  recruitCost: ResourceWallet | undefined,
): (keyof ResourceWallet)[] {
  const cost = recruitCost ?? {};
  const keys: (keyof ResourceWallet)[] = [];
  for (const key of MATERIAL_WALLET_KEYS) {
    const need = cost[key] ?? 0;
    if (need <= 0) continue;
    const delta = (after?.[key] ?? 0) - (before?.[key] ?? 0);
    if (delta < 0) keys.push(key);
  }
  return keys;
}

export type RecruitSuccessFeedback = {
  statusText: string;
  heroId: number | null;
  showDetailLink: boolean;
};

export function buildRecruitSuccessFeedback(
  res: RecruitHeroResult,
  template: RecruitTemplatePreview | undefined,
): RecruitSuccessFeedback {
  const heroId = res.hero_id ?? null;
  return {
    statusText: formatRecruitSuccessStatus(res, template),
    heroId,
    showDetailLink: heroId != null && heroId > 0,
  };
}

/** 成功摘要 + 可选「打开详情」链（`data-hero-id` 深链到详情区）。 */
export function setRecruitSuccessToastDisplay(
  formRoot: ParentNode | null | undefined,
  feedback: RecruitSuccessFeedback | null,
): void {
  const wrap = formRoot?.querySelector('[data-role="recruit-success-toast"]');
  const msg = formRoot?.querySelector('[data-role="recruit-success-msg"]');
  const link = formRoot?.querySelector<HTMLButtonElement>(
    '[data-action="recruit-open-hero-detail"]',
  );
  if (!wrap || !msg || !link) return;
  if (!feedback) {
    wrap.classList.add("hidden");
    msg.textContent = "";
    link.hidden = true;
    link.removeAttribute("data-hero-id");
    return;
  }
  msg.textContent = feedback.statusText;
  wrap.classList.remove("hidden");
  if (feedback.showDetailLink && feedback.heroId) {
    link.hidden = false;
    link.setAttribute("data-hero-id", String(feedback.heroId));
  } else {
    link.hidden = true;
    link.removeAttribute("data-hero-id");
  }
}
