import type { ResourceWallet } from "@/net/bootstrapSession";
import type { BagStack } from "@/net/bagState";
import { formatResourceAmount } from "@/net/hudFormat";
import { compareRecruitAffordability, type RecruitTemplateCost } from "@/net/recruitAffordability";
import type { RecruitTemplatePreview } from "@/net/heroMailState";
import { formatRecruitTemplateInlineResidualDeepestDeepestDeepestDeeperSummary } from "@/net/recruitTemplateInlineResidualDeepestDeepestDeepestDeeperSummary";

/** CLIENT-385：招募模板行内残余摘要 **巩固再加深五层**（CLIENT-056/215 **不退化**；**非** IAP）。 */
export const RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_CLASS =
  "recruit-template-inline-residual-deepest-deepest-deepest-deepest-deeper-summary";
export const RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE =
  "recruit-template-inline-residual-deepest-deepest-deepest-deepest-deeper-summary";

function formatAffordDeepestDeepestDeepestDeepestDeeperBalanceSnippet(line: {
  kind: "resource" | "item";
  label: string;
  required: number;
  available: number;
  sufficient: boolean;
}): string {
  const need =
    line.kind === "resource" ? formatResourceAmount(line.required) : String(line.required);
  const have =
    line.kind === "resource" ? formatResourceAmount(line.available) : String(line.available);
  const flag = line.sufficient ? "足" : "缺";
  return `${line.label}余${have}/需${need}(${flag})`;
}

/**
 * 模板 id + 币种/道具余额余需 **巩固再加深五层** 行内只读摘要（CLIENT-369 五层行 **不退化**）。
 */
export function formatRecruitTemplateInlineResidualDeepestDeepestDeepestDeepestDeeperSummary(
  wallet: ResourceWallet | undefined,
  template: RecruitTemplatePreview | RecruitTemplateCost | undefined,
  bag: BagStack[] = [],
): string | null {
  const deepestDeepestDeepestDeeper = formatRecruitTemplateInlineResidualDeepestDeepestDeepestDeeperSummary(
    wallet,
    template,
    bag,
  );
  if (!deepestDeepestDeepestDeeper) return null;
  const tplId = template && "template_cfg_id" in template ? template.template_cfg_id : undefined;
  const id = tplId ?? 0;
  if (!template || id <= 0) return null;
  const afford = compareRecruitAffordability(wallet, template, bag);
  const balances =
    afford.lines.length > 0
      ? afford.lines.map(formatAffordDeepestDeepestDeepestDeepestDeeperBalanceSnippet).join(" · ")
      : "无消耗";
  return `摘要巩固再加深五层 · 模板#${id} · ${balances} · 加深 ${deepestDeepestDeepestDeeper}`;
}
