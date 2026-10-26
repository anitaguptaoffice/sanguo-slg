import type { ResourceWallet } from "@/net/bootstrapSession";
import { formatResourceAmount } from "@/net/hudFormat";
import type { MarchFormTroopReserveLineResult } from "@/net/marchFormTroopReserve";
import type { MarchFormSummaryResult } from "@/net/marchFormSummary";
import {
  formatMarchFormTroopMarginResidualLine,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_ROLE,
  syncMarchFormTroopMarginResidualLine,
  type MarchFormTroopMarginResidualLine,
} from "@/net/marchFormTroopMarginResidual";

/** CLIENT-269：CLIENT-253 残余次行下的兵力余量 + 钱包只读加深第三行。 */
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEP_LINE_CLASS =
  "march-form-troop-margin-residual-deep-line";
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEP_LINE_ROLE =
  "march-form-troop-margin-residual-deep-line";

export type MarchFormTroopMarginResidualDeepLine = MarchFormTroopMarginResidualLine & {
  deepLine: string;
};

/**
 * 在 CLIENT-253 主行 + 钱包残余次行之上，只读巩固兵力余量 ↔ 粮途耗对照第三行。
 */
export function formatMarchFormTroopMarginResidualDeepLine(
  reserve: MarchFormTroopReserveLineResult | null,
  summary: MarchFormSummaryResult | null,
  wallet: ResourceWallet | undefined,
): MarchFormTroopMarginResidualDeepLine | null {
  const residual = formatMarchFormTroopMarginResidualLine(reserve, summary, wallet);
  if (!residual || reserve?.selected == null) return null;

  const selected = reserve.selected;
  const available = reserve.available;
  const marginAfter = Math.max(0, available - selected);
  const marginSnippet = reserve.insufficient
    ? `超出可用 ${selected - available}`
    : `出征后余 ${marginAfter}`;

  const foodNeed = summary?.estimatedFoodCost ?? 0;
  const foodHave = wallet?.food ?? 0;
  const walletSnippet =
    foodNeed > 0
      ? `粮持 ${formatResourceAmount(foodHave)} / 途粮估算 ${formatResourceAmount(foodNeed)}（不扣粮）`
      : `粮持 ${formatResourceAmount(foodHave)} · 途耗待算`;

  const deepLine = `余量深对照 · ${marginSnippet} ↔ ${walletSnippet}`;
  return { ...residual, deepLine };
}

export function syncMarchFormTroopMarginResidualDeepLine(
  formRoot: ParentNode | null | undefined,
  deep: MarchFormTroopMarginResidualDeepLine | null,
): void {
  syncMarchFormTroopMarginResidualLine(formRoot, deep);

  const root = formRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_ROLE}"]`,
  );
  const deepEl = root?.querySelector<HTMLElement>(
    `[data-role="${MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEP_LINE_ROLE}"]`,
  );
  if (!deepEl) return;

  if (!deep?.deepLine) {
    deepEl.textContent = "";
    deepEl.classList.add("hidden");
    deepEl.classList.remove(MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEP_LINE_CLASS);
    return;
  }

  deepEl.textContent = deep.deepLine;
  deepEl.classList.remove("hidden");
  deepEl.classList.add(MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEP_LINE_CLASS);
}
