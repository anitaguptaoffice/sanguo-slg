import type { ResourceWallet } from "@/net/bootstrapSession";
import type { BagStack } from "@/net/bagState";
import { recruitAffordabilityForTemplate } from "@/net/recruitAffordability";
import {
  formatRecruitDeductSummary,
  heroTemplateLabel,
  type RecruitHeroResult,
  type RecruitTemplatePreview,
} from "@/net/heroMailState";
import { scrollHeroListRowIntoView } from "@/net/heroListRefreshFeedback";
import { formatRecruitWalletCompareLine, syncRecruitWalletCompareLine } from "@/net/recruitWalletCompare";
import { formatRecruitWalletSweepLine } from "@/net/recruitWalletSweep";

/** 招募主按钮默认文案（CLIENT-098）。 */
export const RECRUIT_SUBMIT_DEFAULT_LABEL = "招募";
/** RecruitHero 网关往返期间主按钮文案（CLIENT-114 巩固）。 */
export const RECRUIT_SUBMIT_INFLIGHT_LABEL = "招募中…";
export const HERO_ROW_RECRUITED_PULSE_CLASS = "hero-row-recruited-pulse";
/** 招募成功行脉冲时长（≤2s，与 hero-list-refresh-pulse 并存）。 */
export const HERO_ROW_RECRUITED_PULSE_MS = 1200;
/** RecruitHero 往返期间招募预览行 loading（CLIENT-183）。 */
export const RECRUIT_SUBMITTING_CLASS = "recruit-submitting";
export const RECRUIT_SUBMIT_INFLIGHT_PREVIEW = "招募提交中…";
/** 招募币种扫读次行成功脉冲（CLIENT-183，≠ 商城购买脉冲）。 */
export const RECRUIT_SUCCESS_PULSE_CLASS = "recruit-success-pulse";
export const RECRUIT_SUCCESS_PULSE_MS = 1500;
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

export function scheduleHeroRecruitRowPulse(row: HTMLElement | null | undefined): void {
  if (!row) return;
  row.classList.remove(HERO_ROW_RECRUITED_PULSE_CLASS);
  void row.offsetWidth;
  row.classList.add(HERO_ROW_RECRUITED_PULSE_CLASS);
  window.setTimeout(
    () => row.classList.remove(HERO_ROW_RECRUITED_PULSE_CLASS),
    HERO_ROW_RECRUITED_PULSE_MS,
  );
}

/** ListPlayerHeroes 刷新后滚入视并脉冲新招募行（CLIENT-114）。 */
export function focusRecruitedHeroListRow(
  panel: ParentNode | null | undefined,
  heroId: number,
): void {
  if (heroId <= 0) return;
  scrollHeroListRowIntoView(panel, heroId);
  const row = panel?.querySelector<HTMLElement>(`li[data-hero-id="${heroId}"]`);
  scheduleHeroRecruitRowPulse(row);
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

/** 成功行内摘要：将领名 + 扣费币种（仅用 RecruitHero 响应与模板，无额外 hero RPC）。 */
export function formatRecruitSuccessLine(
  res: RecruitHeroResult,
  template: RecruitTemplatePreview | undefined,
): string {
  const tplId = res.template_cfg_id ?? template?.template_cfg_id;
  const name = template?.template_name?.trim() || heroTemplateLabel(tplId);
  const deduct = formatRecruitDeductSummary(template);
  return `招募成功：${name} · 已扣 ${deduct}`;
}

export function buildRecruitSuccessFeedback(
  res: RecruitHeroResult,
  template: RecruitTemplatePreview | undefined,
): RecruitSuccessFeedback {
  const heroId = res.hero_id ?? null;
  return {
    statusText: formatRecruitSuccessLine(res, template),
    heroId,
    showDetailLink: heroId != null && heroId > 0,
  };
}

/** `data-role="recruit-preview"` 行内 loading（CLIENT-183）。 */
export function syncRecruitSubmittingLine(
  formRoot: ParentNode | null | undefined,
  submitting: boolean,
): void {
  const preview = formRoot?.querySelector<HTMLElement>('[data-role="recruit-preview"]');
  if (!preview) return;
  preview.classList.toggle(RECRUIT_SUBMITTING_CLASS, submitting);
  preview.toggleAttribute("aria-busy", submitting);
  if (submitting) preview.textContent = RECRUIT_SUBMIT_INFLIGHT_PREVIEW;
}

/** 成功后刷新 CLIENT-166 钱包扫读次行（同源 GetCityState / 会话 wallet）。 */
export function refreshRecruitWalletSweepDisplays(
  formRoot: ParentNode | null | undefined,
  templateCfgId: number,
  template: RecruitTemplatePreview | undefined,
  wallet: ResourceWallet | undefined,
  bag: BagStack[] | undefined,
): void {
  if (!template || templateCfgId <= 0) return;
  const sweep = formatRecruitWalletSweepLine(wallet, template, bag ?? []);
  const { primary } = recruitAffordabilityForTemplate(template, wallet, bag);
  const preview = formRoot?.querySelector<HTMLElement>('[data-role="recruit-preview"]');
  if (preview && !preview.classList.contains(RECRUIT_SUBMITTING_CLASS)) {
    preview.textContent = `${primary} — ${sweep.text}`;
  }
  const rowSecondary = formRoot?.querySelector<HTMLElement>(
    `li[data-template-id="${templateCfgId}"] .recruit-afford-secondary`,
  );
  if (rowSecondary) {
    rowSecondary.textContent = sweep.text;
    rowSecondary.classList.toggle("recruit-cost-deficit", sweep.hasDeficit);
  }
  syncRecruitWalletCompareLine(
    formRoot,
    formatRecruitWalletCompareLine(wallet, template, bag ?? []),
  );
}

/** 招募币种扫读行成功脉冲（列表次行 + 预览行，1.5s）。 */
export function scheduleRecruitWalletSweepPulse(
  formRoot: ParentNode | null | undefined,
  templateCfgId: number,
): void {
  const targets: HTMLElement[] = [];
  const preview = formRoot?.querySelector<HTMLElement>('[data-role="recruit-preview"]');
  if (preview) targets.push(preview);
  if (templateCfgId > 0) {
    const rowSecondary = formRoot?.querySelector<HTMLElement>(
      `li[data-template-id="${templateCfgId}"] .recruit-afford-secondary`,
    );
    if (rowSecondary) targets.push(rowSecondary);
  }
  for (const el of targets) {
    el.classList.remove(RECRUIT_SUCCESS_PULSE_CLASS);
    void el.offsetWidth;
    el.classList.add(RECRUIT_SUCCESS_PULSE_CLASS);
    window.setTimeout(() => el.classList.remove(RECRUIT_SUCCESS_PULSE_CLASS), RECRUIT_SUCCESS_PULSE_MS);
  }
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
