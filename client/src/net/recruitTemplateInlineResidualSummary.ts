import type { ResourceWallet } from "@/net/bootstrapSession";
import type { BagStack } from "@/net/bagState";
import { formatResourceAmount } from "@/net/hudFormat";
import { compareRecruitAffordability, type RecruitTemplateCost } from "@/net/recruitAffordability";
import type { RecruitTemplatePreview } from "@/net/heroMailState";

/** CLIENT-257：招募模板列表行内只读残余摘要（CLIENT-056/215 主行 **不退化**；**非** IAP）。 */
export const RECRUIT_TEMPLATE_INLINE_RESIDUAL_SUMMARY_CLASS =
  "recruit-template-inline-residual-summary";
export const RECRUIT_TEMPLATE_INLINE_RESIDUAL_SUMMARY_ROLE =
  "recruit-template-inline-residual-summary";

/**
 * 模板 id + 涉及币种/道具当前余额只读行内摘要（与 `formatRecruitWalletSweepLine` 同源余额）。
 */
export function formatRecruitTemplateInlineResidualSummary(
  wallet: ResourceWallet | undefined,
  template: RecruitTemplatePreview | RecruitTemplateCost | undefined,
  bag: BagStack[] = [],
): string | null {
  const tplId = template && "template_cfg_id" in template ? template.template_cfg_id : undefined;
  const id = tplId ?? 0;
  if (!template || id <= 0) return null;
  const afford = compareRecruitAffordability(wallet, template, bag);
  if (!afford.lines.length) return `模板#${id}`;
  const balances = afford.lines
    .map((l) => {
      const have =
        l.kind === "resource" ? formatResourceAmount(l.available) : String(l.available);
      return `${l.label}余${have}`;
    })
    .join(" · ");
  return `模板#${id} · ${balances}`;
}

export function syncRecruitTemplateInlineResidualSummary(
  listItem: ParentNode | null | undefined,
  summary: string | null,
): void {
  const el = listItem?.querySelector<HTMLElement>(
    `[data-role="${RECRUIT_TEMPLATE_INLINE_RESIDUAL_SUMMARY_ROLE}"]`,
  );
  if (!el) return;
  if (!summary?.trim()) {
    el.textContent = "";
    el.hidden = true;
    el.classList.add("hidden");
    return;
  }
  el.textContent = summary;
  el.hidden = false;
  el.classList.remove("hidden");
}
