import type { ResourceWallet } from "@/net/bootstrapSession";
import type { MarchFormTroopReserveLineResult } from "@/net/marchFormTroopReserve";
import type { MarchFormSummaryResult } from "@/net/marchFormSummary";
import { MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_ROLE } from "@/net/marchFormTroopMarginResidual";
import {
  formatMarchFormTroopMarginResidualDeepLine,
  syncMarchFormTroopMarginResidualDeepLine,
  type MarchFormTroopMarginResidualDeepLine,
} from "@/net/marchFormTroopMarginResidualDeep";

/** CLIENT-285：CLIENT-269 深对照第三行下的兵力余量 + 钱包只读 **巩固再加深** 第四行。 */
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPER_LINE_CLASS =
  "march-form-troop-margin-residual-deeper-line";
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPER_LINE_ROLE =
  "march-form-troop-margin-residual-deeper-line";

export type MarchFormTroopMarginResidualDeeperLine = MarchFormTroopMarginResidualDeepLine & {
  deeperLine: string;
};

/**
 * 在 CLIENT-269 第三行之上，只读巩固兵力余量 ↔ 钱包粮途耗对照第四行（CLIENT-206/048 **不退化**）。
 */
export function formatMarchFormTroopMarginResidualDeeperLine(
  reserve: MarchFormTroopReserveLineResult | null,
  summary: MarchFormSummaryResult | null,
  wallet: ResourceWallet | undefined,
): MarchFormTroopMarginResidualDeeperLine | null {
  const deep = formatMarchFormTroopMarginResidualDeepLine(reserve, summary, wallet);
  if (!deep?.deepLine) return null;

  const marginPart = reserve?.insufficient
    ? `余量警示 ↔ 粮途`
    : `余量巩固 ↔ 粮持`;
  const deeperLine = `巩固再加深 · ${marginPart} · ${deep.deepLine}`;
  return { ...deep, deeperLine };
}

export function syncMarchFormTroopMarginResidualDeeperLine(
  formRoot: ParentNode | null | undefined,
  deeper: MarchFormTroopMarginResidualDeeperLine | null,
): void {
  syncMarchFormTroopMarginResidualDeepLine(formRoot, deeper);

  const root = formRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_ROLE}"]`,
  );
  const deeperEl = root?.querySelector<HTMLElement>(
    `[data-role="${MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPER_LINE_ROLE}"]`,
  );
  if (!deeperEl) return;

  if (!deeper?.deeperLine) {
    deeperEl.textContent = "";
    deeperEl.classList.add("hidden");
    deeperEl.classList.remove(MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPER_LINE_CLASS);
    return;
  }

  deeperEl.textContent = deeper.deeperLine;
  deeperEl.classList.remove("hidden");
  deeperEl.classList.add(MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPER_LINE_CLASS);
}
