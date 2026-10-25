import type { ResourceWallet } from "@/net/bootstrapSession";
import type { MarchFormTroopReserveLineResult } from "@/net/marchFormTroopReserve";
import type { MarchFormSummaryResult } from "@/net/marchFormSummary";
import { MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_ROLE } from "@/net/marchFormTroopMarginResidual";
import {
  formatMarchFormTroopMarginResidualDeepestDeepestDeeperLine,
  syncMarchFormTroopMarginResidualDeepestDeepestDeeperLine,
  type MarchFormTroopMarginResidualDeepestDeepestDeeperLine,
} from "@/net/marchFormTroopMarginResidualDeepestDeepestDeeper";

/** CLIENT-349：CLIENT-333 巩固再加深三层第七行下的兵力余量 + 钱包只读 **巩固再加深四层** 第八行。 */
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS =
  "march-form-troop-margin-residual-deepest-deepest-deepest-line";
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_ROLE =
  "march-form-troop-margin-residual-deepest-deepest-deepest-line";

export type MarchFormTroopMarginResidualDeepestDeepestDeepestLine =
  MarchFormTroopMarginResidualDeepestDeepestDeeperLine & {
    deepestDeepestDeepestLine: string;
  };

/**
 * 在 CLIENT-333 第七行之上，只读巩固兵力余量 ↔ 钱包粮途耗对照 **巩固再加深四层** 行（CLIENT-206/048 **不退化**）。
 */
export function formatMarchFormTroopMarginResidualDeepestDeepestDeepestLine(
  reserve: MarchFormTroopReserveLineResult | null,
  summary: MarchFormSummaryResult | null,
  wallet: ResourceWallet | undefined,
): MarchFormTroopMarginResidualDeepestDeepestDeepestLine | null {
  const deepestDeepestDeeper = formatMarchFormTroopMarginResidualDeepestDeepestDeeperLine(
    reserve,
    summary,
    wallet,
  );
  if (!deepestDeepestDeeper?.deepestDeepestDeeperLine) return null;

  const marginPart = reserve?.insufficient
    ? `余量四层警示 ↔ 粮途`
    : `余量四层巩固 ↔ 粮稳`;
  const deepestDeepestDeepestLine = `巩固再加深四层 · ${marginPart} · ${deepestDeepestDeeper.deepestDeepestDeeperLine}`;
  return { ...deepestDeepestDeeper, deepestDeepestDeepestLine };
}

export function syncMarchFormTroopMarginResidualDeepestDeepestDeepestLine(
  formRoot: ParentNode | null | undefined,
  deepestDeepestDeepest: MarchFormTroopMarginResidualDeepestDeepestDeepestLine | null,
): void {
  syncMarchFormTroopMarginResidualDeepestDeepestDeeperLine(formRoot, deepestDeepestDeepest);

  const root = formRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_ROLE}"]`,
  );
  const deepestDeepestDeepestEl = root?.querySelector<HTMLElement>(
    `[data-role="${MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_ROLE}"]`,
  );
  if (!deepestDeepestDeepestEl) return;

  if (!deepestDeepestDeepest?.deepestDeepestDeepestLine) {
    deepestDeepestDeepestEl.textContent = "";
    deepestDeepestDeepestEl.classList.add("hidden");
    deepestDeepestDeepestEl.classList.remove(
      MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS,
    );
    return;
  }

  deepestDeepestDeepestEl.textContent = deepestDeepestDeepest.deepestDeepestDeepestLine;
  deepestDeepestDeepestEl.classList.remove("hidden");
  deepestDeepestDeepestEl.classList.add(
    MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS,
  );
}
