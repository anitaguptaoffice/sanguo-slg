import type { ResourceWallet } from "@/net/bootstrapSession";
import type { MarchFormTroopReserveLineResult } from "@/net/marchFormTroopReserve";
import type { MarchFormSummaryResult } from "@/net/marchFormSummary";
import { MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_ROLE } from "@/net/marchFormTroopMarginResidual";
import {
  formatMarchFormTroopMarginResidualDeepestDeepestDeepestLine,
  syncMarchFormTroopMarginResidualDeepestDeepestDeepestLine,
  type MarchFormTroopMarginResidualDeepestDeepestDeepestLine,
} from "@/net/marchFormTroopMarginResidualDeepestDeepestDeepest";

/** CLIENT-365：CLIENT-349 巩固再加深四层第八行下的兵力余量 + 钱包只读 **巩固再加深五层** 第九行。 */
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_CLASS =
  "march-form-troop-margin-residual-deepest-deepest-deepest-deeper-line";
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_ROLE =
  "march-form-troop-margin-residual-deepest-deepest-deepest-deeper-line";

export type MarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine =
  MarchFormTroopMarginResidualDeepestDeepestDeepestLine & {
    deepestDeepestDeepestDeeperLine: string;
  };

/**
 * 在 CLIENT-349 第八行之上，只读巩固兵力余量 ↔ 钱包粮途耗对照 **巩固再加深五层** 行（CLIENT-206/048 **不退化**）。
 */
export function formatMarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine(
  reserve: MarchFormTroopReserveLineResult | null,
  summary: MarchFormSummaryResult | null,
  wallet: ResourceWallet | undefined,
): MarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine | null {
  const deepestDeepestDeepest = formatMarchFormTroopMarginResidualDeepestDeepestDeepestLine(
    reserve,
    summary,
    wallet,
  );
  if (!deepestDeepestDeepest?.deepestDeepestDeepestLine) return null;

  const marginPart = reserve?.insufficient
    ? `余量五层警示 ↔ 粮途`
    : `余量五层巩固 ↔ 粮稳`;
  const deepestDeepestDeepestDeeperLine = `巩固再加深五层 · ${marginPart} · ${deepestDeepestDeepest.deepestDeepestDeepestLine}`;
  return { ...deepestDeepestDeepest, deepestDeepestDeepestDeeperLine };
}

export function syncMarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine(
  formRoot: ParentNode | null | undefined,
  deepestDeepestDeepestDeeper: MarchFormTroopMarginResidualDeepestDeepestDeepestDeeperLine | null,
): void {
  syncMarchFormTroopMarginResidualDeepestDeepestDeepestLine(formRoot, deepestDeepestDeepestDeeper);

  const root = formRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_ROLE}"]`,
  );
  const deepestDeepestDeepestDeeperEl = root?.querySelector<HTMLElement>(
    `[data-role="${MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_ROLE}"]`,
  );
  if (!deepestDeepestDeepestDeeperEl) return;

  if (!deepestDeepestDeepestDeeper?.deepestDeepestDeepestDeeperLine) {
    deepestDeepestDeepestDeeperEl.textContent = "";
    deepestDeepestDeepestDeeperEl.classList.add("hidden");
    deepestDeepestDeepestDeeperEl.classList.remove(
      MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_CLASS,
    );
    return;
  }

  deepestDeepestDeepestDeeperEl.textContent =
    deepestDeepestDeepestDeeper.deepestDeepestDeepestDeeperLine;
  deepestDeepestDeepestDeeperEl.classList.remove("hidden");
  deepestDeepestDeepestDeeperEl.classList.add(
    MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_CLASS,
  );
}
