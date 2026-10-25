import type { ResourceWallet } from "@/net/bootstrapSession";
import type { MarchFormTroopReserveLineResult } from "@/net/marchFormTroopReserve";
import type { MarchFormSummaryResult } from "@/net/marchFormSummary";
import { MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_ROLE } from "@/net/marchFormTroopMarginResidual";
import {
  formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine,
  syncMarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine,
  type MarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine,
} from "@/net/marchFormTroopMarginResidualDeepestDeepestDeepestDeeper";

/** CLIENT-381：CLIENT-365 巩固再加深五层第九行下的兵力余量 + 钱包只读 **巩固再加深五层** 第十行。 */
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_CLASS =
  "march-form-troop-margin-residual-deepest-deepest-deepest-deepest-deeper-line";
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_ROLE =
  "march-form-troop-margin-residual-deepest-deepest-deepest-deepest-deeper-line";

export type MarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine =
  MarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine & {
    deepestDeepestDeepestDeepestDeeperLine: string;
  };

/**
 * 在 CLIENT-365 第九行之上，只读巩固兵力余量 ↔ 钱包粮途耗对照 **巩固再加深五层** 行（CLIENT-206/048 **不退化**）。
 */
export function formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine(
  reserve: MarchFormTroopReserveLineResult | null,
  summary: MarchFormSummaryResult | null,
  wallet: ResourceWallet | undefined,
): MarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine | null {
  const deepestDeepestDeepestDeeper = formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine(
    reserve,
    summary,
    wallet,
  );
  if (!deepestDeepestDeepestDeeper?.deepestDeepestDeepestDeeperLine) return null;

  const marginPart = reserve?.insufficient
    ? `余量六层警示 ↔ 粮途`
    : `余量六层巩固 ↔ 粮稳`;
  const deepestDeepestDeepestDeepestDeeperLine = `巩固再加深五层 · ${marginPart} · ${deepestDeepestDeepestDeeper.deepestDeepestDeepestDeeperLine}`;
  return { ...deepestDeepestDeepestDeeper, deepestDeepestDeepestDeepestDeeperLine };
}

export function syncMarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine(
  formRoot: ParentNode | null | undefined,
  deepestDeepestDeepestDeepestDeeper: MarchFormTroopMarginResidualDeepestDeepestDeepestDeepestDeeperLine | null,
): void {
  syncMarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine(
    formRoot,
    deepestDeepestDeepestDeepestDeeper,
  );

  const root = formRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_ROLE}"]`,
  );
  const deepestDeepestDeepestDeepestDeeperEl = root?.querySelector<HTMLElement>(
    `[data-role="${MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_ROLE}"]`,
  );
  if (!deepestDeepestDeepestDeepestDeeperEl) return;

  if (!deepestDeepestDeepestDeepestDeeper?.deepestDeepestDeepestDeepestDeeperLine) {
    deepestDeepestDeepestDeepestDeeperEl.textContent = "";
    deepestDeepestDeepestDeepestDeeperEl.classList.add("hidden");
    deepestDeepestDeepestDeepestDeeperEl.classList.remove(
      MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_CLASS,
    );
    return;
  }

  deepestDeepestDeepestDeepestDeeperEl.textContent =
    deepestDeepestDeepestDeepestDeeper.deepestDeepestDeepestDeepestDeeperLine;
  deepestDeepestDeepestDeepestDeeperEl.classList.remove("hidden");
  deepestDeepestDeepestDeepestDeeperEl.classList.add(
    MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_CLASS,
  );
}
