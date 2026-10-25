import type { ResourceWallet } from "@/net/bootstrapSession";
import type { MarchFormTroopReserveLineResult } from "@/net/marchFormTroopReserve";
import type { MarchFormSummaryResult } from "@/net/marchFormSummary";
import { MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_ROLE } from "@/net/marchFormTroopMarginResidual";
import {
  formatMarchFormTroopMarginResidualDeepestLine,
  syncMarchFormTroopMarginResidualDeepestLine,
  type MarchFormTroopMarginResidualDeepestLine,
} from "@/net/marchFormTroopMarginResidualDeepest";

/** CLIENT-317：CLIENT-301 巩固再加深一层第五行下的兵力余量 + 钱包只读 **巩固再加深二层** 第六行。 */
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS =
  "march-form-troop-margin-residual-deepest-deeper-line";
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPER_LINE_ROLE =
  "march-form-troop-margin-residual-deepest-deeper-line";

export type MarchFormTroopMarginResidualDeepestDeeperLine =
  MarchFormTroopMarginResidualDeepestLine & {
    deepestDeeperLine: string;
  };

/**
 * 在 CLIENT-301 第五行之上，只读巩固兵力余量 ↔ 钱包粮途耗对照 **巩固再加深二层** 行（CLIENT-206/048 **不退化**）。
 */
export function formatMarchFormTroopMarginResidualDeepestDeeperLine(
  reserve: MarchFormTroopReserveLineResult | null,
  summary: MarchFormSummaryResult | null,
  wallet: ResourceWallet | undefined,
): MarchFormTroopMarginResidualDeepestDeeperLine | null {
  const deepest = formatMarchFormTroopMarginResidualDeepestLine(reserve, summary, wallet);
  if (!deepest?.deepestLine) return null;

  const marginPart = reserve?.insufficient
    ? `余量二层警示 ↔ 粮途`
    : `余量二层巩固 ↔ 粮稳`;
  const deepestDeeperLine = `巩固再加深二层 · ${marginPart} · ${deepest.deepestLine}`;
  return { ...deepest, deepestDeeperLine };
}

export function syncMarchFormTroopMarginResidualDeepestDeeperLine(
  formRoot: ParentNode | null | undefined,
  deepestDeeper: MarchFormTroopMarginResidualDeepestDeeperLine | null,
): void {
  syncMarchFormTroopMarginResidualDeepestLine(formRoot, deepestDeeper);

  const root = formRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_ROLE}"]`,
  );
  const deepestDeeperEl = root?.querySelector<HTMLElement>(
    `[data-role="${MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPER_LINE_ROLE}"]`,
  );
  if (!deepestDeeperEl) return;

  if (!deepestDeeper?.deepestDeeperLine) {
    deepestDeeperEl.textContent = "";
    deepestDeeperEl.classList.add("hidden");
    deepestDeeperEl.classList.remove(MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS);
    return;
  }

  deepestDeeperEl.textContent = deepestDeeper.deepestDeeperLine;
  deepestDeeperEl.classList.remove("hidden");
  deepestDeeperEl.classList.add(MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS);
}
