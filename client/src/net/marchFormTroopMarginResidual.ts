import type { ResourceWallet } from "@/net/bootstrapSession";
import { formatResourceAmount } from "@/net/hudFormat";
import type { MarchFormTroopReserveLineResult } from "@/net/marchFormTroopReserve";
import type { MarchFormSummaryResult } from "@/net/marchFormSummary";

/** CLIENT-253：军事出征底栏兵力余量 + 钱包只读残余次行（CLIENT-206/048 **不退化**）。 */
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_ROLE = "march-form-troop-margin-residual-line";
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_CLASS = "march-form-troop-margin-residual-line";
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_SUBLINE_CLASS =
  "march-form-troop-margin-residual-subline";
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_WARN_CLASS = "march-form-troop-margin-residual-warn";

export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_PRIMARY_ROLE =
  "march-form-troop-margin-residual-primary";
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_SUBLINE_ROLE =
  "march-form-troop-margin-residual-subline";

export type MarchFormTroopMarginResidualLine = {
  line: string;
  subline: string;
  hasWarn: boolean;
};

/**
 * 底栏残余：顶栏 `formatMarchFormTroopReserveLine` 兵力余量警示 + 钱包粮途耗只读对照次行。
 */
export function formatMarchFormTroopMarginResidualLine(
  reserve: MarchFormTroopReserveLineResult | null,
  summary: MarchFormSummaryResult | null,
  wallet: ResourceWallet | undefined,
): MarchFormTroopMarginResidualLine | null {
  if (reserve?.selected == null) return null;

  const selected = reserve.selected;
  const available = reserve.available;
  const marginAfter = Math.max(0, available - selected);

  let line: string;
  let hasWarn = reserve.insufficient;
  if (reserve.insufficient) {
    line = `兵力余量警示 · 超出城内可用 ${selected - available}`;
  } else {
    line = `兵力余量 · 出征后城内余 ${marginAfter}`;
  }

  const foodNeed = summary?.estimatedFoodCost ?? 0;
  const foodHave = wallet?.food ?? 0;
  let subline: string;
  if (foodNeed > 0) {
    subline = `钱包粮 持 ${formatResourceAmount(foodHave)} / 途耗约 ${formatResourceAmount(foodNeed)}`;
    if (foodHave < foodNeed) hasWarn = true;
  } else {
    subline = `钱包粮 持 ${formatResourceAmount(foodHave)} · 途耗待算`;
  }

  return { line, subline, hasWarn };
}

export function syncMarchFormTroopMarginResidualLine(
  formRoot: ParentNode | null | undefined,
  residual: MarchFormTroopMarginResidualLine | null,
): void {
  const root = formRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_ROLE}"]`,
  );
  if (!root) return;

  const primary = root.querySelector<HTMLElement>(
    `[data-role="${MARCH_FORM_TROOP_MARGIN_RESIDUAL_PRIMARY_ROLE}"]`,
  );
  const subline = root.querySelector<HTMLElement>(
    `[data-role="${MARCH_FORM_TROOP_MARGIN_RESIDUAL_SUBLINE_ROLE}"]`,
  );

  if (!residual?.line) {
    root.classList.add("hidden");
    root.classList.remove(MARCH_FORM_TROOP_MARGIN_RESIDUAL_WARN_CLASS);
    if (primary) primary.textContent = "";
    if (subline) subline.textContent = "";
    return;
  }

  root.classList.remove("hidden");
  root.classList.add(MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_CLASS);
  root.classList.toggle(MARCH_FORM_TROOP_MARGIN_RESIDUAL_WARN_CLASS, residual.hasWarn);
  if (primary) primary.textContent = residual.line;
  if (subline) {
    subline.textContent = residual.subline;
    subline.classList.add(MARCH_FORM_TROOP_MARGIN_RESIDUAL_SUBLINE_CLASS);
  }
}
