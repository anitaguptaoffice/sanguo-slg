import type { ResourceWallet } from "@/net/bootstrapSession";
import type { MarchFormTroopReserveLineResult } from "@/net/marchFormTroopReserve";
import type { MarchFormSummaryResult } from "@/net/marchFormSummary";
import { MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_ROLE } from "@/net/marchFormTroopMarginResidual";
import {
  formatMarchFormTroopMarginResidualDeepestDeeperLine,
  syncMarchFormTroopMarginResidualDeepestDeeperLine,
  type MarchFormTroopMarginResidualDeepestDeeperLine,
} from "@/net/marchFormTroopMarginResidualDeepestDeeper";

/** CLIENT-333：CLIENT-317 巩固再加深二层第六行下的兵力余量 + 钱包只读 **巩固再加深三层** 第七行。 */
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_CLASS =
  "march-form-troop-margin-residual-deepest-deepest-deeper-line";
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_ROLE =
  "march-form-troop-margin-residual-deepest-deepest-deeper-line";

export type MarchFormTroopMarginResidualDeepestDeepestDeeperLine =
  MarchFormTroopMarginResidualDeepestDeeperLine & {
    deepestDeepestDeeperLine: string;
  };

/**
 * 在 CLIENT-317 第六行之上，只读巩固兵力余量 ↔ 钱包粮途耗对照 **巩固再加深三层** 行（CLIENT-206/048 **不退化**）。
 */
export function formatMarchFormTroopMarginResidualDeepestDeepestDeeperLine(
  reserve: MarchFormTroopReserveLineResult | null,
  summary: MarchFormSummaryResult | null,
  wallet: ResourceWallet | undefined,
): MarchFormTroopMarginResidualDeepestDeepestDeeperLine | null {
  const deepestDeeper = formatMarchFormTroopMarginResidualDeepestDeeperLine(reserve, summary, wallet);
  if (!deepestDeeper?.deepestDeeperLine) return null;

  const marginPart = reserve?.insufficient
    ? `余量三层警示 ↔ 粮途`
    : `余量三层巩固 ↔ 粮稳`;
  const deepestDeepestDeeperLine = `巩固再加深三层 · ${marginPart} · ${deepestDeeper.deepestDeeperLine}`;
  return { ...deepestDeeper, deepestDeepestDeeperLine };
}

export function syncMarchFormTroopMarginResidualDeepestDeepestDeeperLine(
  formRoot: ParentNode | null | undefined,
  deepestDeepestDeeper: MarchFormTroopMarginResidualDeepestDeepestDeeperLine | null,
): void {
  syncMarchFormTroopMarginResidualDeepestDeeperLine(formRoot, deepestDeepestDeeper);

  const root = formRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_ROLE}"]`,
  );
  const deepestDeepestDeeperEl = root?.querySelector<HTMLElement>(
    `[data-role="${MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_ROLE}"]`,
  );
  if (!deepestDeepestDeeperEl) return;

  if (!deepestDeepestDeeper?.deepestDeepestDeeperLine) {
    deepestDeepestDeeperEl.textContent = "";
    deepestDeepestDeeperEl.classList.add("hidden");
    deepestDeepestDeeperEl.classList.remove(
      MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_CLASS,
    );
    return;
  }

  deepestDeepestDeeperEl.textContent = deepestDeepestDeeper.deepestDeepestDeeperLine;
  deepestDeepestDeeperEl.classList.remove("hidden");
  deepestDeepestDeeperEl.classList.add(
    MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_CLASS,
  );
}
