import type { ResourceWallet } from "@/net/bootstrapSession";
import type { MarchFormTroopReserveLineResult } from "@/net/marchFormTroopReserve";
import type { MarchFormSummaryResult } from "@/net/marchFormSummary";
import { MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_ROLE } from "@/net/marchFormTroopMarginResidual";
import {
  formatMarchFormTroopMarginResidualDeeperLine,
  syncMarchFormTroopMarginResidualDeeperLine,
  type MarchFormTroopMarginResidualDeeperLine,
} from "@/net/marchFormTroopMarginResidualDeeper";

/** CLIENT-301：CLIENT-285 巩固再加深第四行下的兵力余量 + 钱包只读 **巩固再加深一层** 第五行。 */
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_LINE_CLASS =
  "march-form-troop-margin-residual-deepest-line";
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_LINE_ROLE =
  "march-form-troop-margin-residual-deepest-line";

export type MarchFormTroopMarginResidualDeepestLine = MarchFormTroopMarginResidualDeeperLine & {
  deepestLine: string;
};

/**
 * 在 CLIENT-285 第四行之上，只读巩固兵力余量 ↔ 钱包粮途耗对照第五行（CLIENT-206/048 **不退化**）。
 */
export function formatMarchFormTroopMarginResidualDeepestLine(
  reserve: MarchFormTroopReserveLineResult | null,
  summary: MarchFormSummaryResult | null,
  wallet: ResourceWallet | undefined,
): MarchFormTroopMarginResidualDeepestLine | null {
  const deeper = formatMarchFormTroopMarginResidualDeeperLine(reserve, summary, wallet);
  if (!deeper?.deeperLine) return null;

  const marginPart = reserve?.insufficient
    ? `余量再警示 ↔ 粮途`
    : `余量再巩固 ↔ 粮稳`;
  const deepestLine = `巩固再加深一层 · ${marginPart} · ${deeper.deeperLine}`;
  return { ...deeper, deepestLine };
}

export function syncMarchFormTroopMarginResidualDeepestLine(
  formRoot: ParentNode | null | undefined,
  deepest: MarchFormTroopMarginResidualDeepestLine | null,
): void {
  syncMarchFormTroopMarginResidualDeeperLine(formRoot, deepest);

  const root = formRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_ROLE}"]`,
  );
  const deepestEl = root?.querySelector<HTMLElement>(
    `[data-role="${MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_LINE_ROLE}"]`,
  );
  if (!deepestEl) return;

  if (!deepest?.deepestLine) {
    deepestEl.textContent = "";
    deepestEl.classList.add("hidden");
    deepestEl.classList.remove(MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_LINE_CLASS);
    return;
  }

  deepestEl.textContent = deepest.deepestLine;
  deepestEl.classList.remove("hidden");
  deepestEl.classList.add(MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_LINE_CLASS);
}
