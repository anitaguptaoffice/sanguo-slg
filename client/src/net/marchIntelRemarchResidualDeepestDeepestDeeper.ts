import type { MarchSummary } from "@/net/militaryFormat";
import type { MarchIntelRemarchPrefill } from "@/net/marchIntelRemarch";
import type { MarchFormInlineFeedbackContext } from "@/net/marchFormSummary";
import { formatMarchFormTroopMarginResidualLine } from "@/net/marchFormTroopMarginResidual";
import {
  formatMarchIntelRemarchResidualDeepestDeeperSummary,
  MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPER_SUMMARY_ROLE,
  prefillMarchFormFromIntelResidualDeepestDeeper,
} from "@/net/marchIntelRemarchResidualDeepestDeeper";

/** CLIENT-338：军情再出征只读坐标/兵力 **巩固再加深三层**摘要行（与 CLIENT-322 二层行 **并存**）。 */
export const MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE =
  "march-intel-remarch-residual-deepest-deepest-deeper-summary";
export const MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUMMARY_CLASS =
  "march-intel-remarch-residual-deepest-deepest-deeper-summary";

export function formatMarchIntelRemarchResidualDeepestDeepestDeeperSummary(
  prefill: MarchIntelRemarchPrefill,
  troopMarginHint?: string | null,
): string {
  const deepestDeeper = formatMarchIntelRemarchResidualDeepestDeeperSummary(prefill, troopMarginHint);
  return `巩固再加深三层 · ${deepestDeeper}`;
}

export function syncMarchIntelRemarchResidualDeepestDeepestDeeperSummary(
  formRoot: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = formRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE}"]`,
  );
  if (!el) return;
  if (!line?.trim()) {
    el.textContent = "";
    el.classList.add("hidden");
    el.classList.remove(MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUMMARY_CLASS);
    return;
  }
  el.textContent = line;
  el.classList.remove("hidden");
  el.classList.add(MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUMMARY_CLASS);
}

export function clearMarchIntelRemarchResidualDeepestDeepestDeeperSummary(
  formRoot: ParentNode | null | undefined,
): void {
  syncMarchIntelRemarchResidualDeepestDeepestDeeperSummary(formRoot, null);
}

/**
 * 军情行「再出征」：CLIENT-322 预填 + 只读 **巩固再加深三层**摘要（CLIENT-253 底栏余量 hint 软依赖；**无** CancelMarch）。
 */
export function prefillMarchFormFromIntelResidualDeepestDeepestDeeper(
  formRoot: ParentNode | null | undefined,
  march: MarchSummary,
  feedback?: MarchFormInlineFeedbackContext,
  storage?: Pick<Storage, "setItem"> | null,
  troopMarginResidual?: ReturnType<typeof formatMarchFormTroopMarginResidualLine> | null,
): MarchIntelRemarchPrefill | null {
  const prefill = prefillMarchFormFromIntelResidualDeepestDeeper(
    formRoot,
    march,
    feedback,
    storage,
    troopMarginResidual,
  );
  if (!prefill) return null;

  const marginHint = troopMarginResidual?.line ?? null;
  syncMarchIntelRemarchResidualDeepestDeepestDeeperSummary(
    formRoot,
    formatMarchIntelRemarchResidualDeepestDeepestDeeperSummary(prefill, marginHint),
  );
  return prefill;
}

/** CLIENT-333 软依赖：无军事面板时安全 no-op。 */
export function stubPrefillMarchFormFromIntelResidualDeepestDeepestDeeper(
  formRoot: ParentNode | null | undefined,
): boolean {
  if (
    !formRoot?.querySelector(`[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPER_SUMMARY_ROLE}"]`)
  ) {
    return false;
  }
  clearMarchIntelRemarchResidualDeepestDeepestDeeperSummary(formRoot);
  return true;
}
