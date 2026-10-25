import type { MarchSummary } from "@/net/militaryFormat";
import type { MarchIntelRemarchPrefill } from "@/net/marchIntelRemarch";
import type { MarchFormInlineFeedbackContext } from "@/net/marchFormSummary";
import { formatMarchFormTroopMarginResidualLine } from "@/net/marchFormTroopMarginResidual";
import {
  formatMarchIntelRemarchResidualDeepestDeepestDeeperSummary,
  MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE,
  prefillMarchFormFromIntelResidualDeepestDeepestDeeper,
} from "@/net/marchIntelRemarchResidualDeepestDeepestDeeper";

/** CLIENT-354：军情再出征只读坐标/兵力 **巩固再加深四层**摘要行（与 CLIENT-338 三层行 **并存**）。 */
export const MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUMMARY_ROLE =
  "march-intel-remarch-residual-deepest-deepest-deepest-summary";
export const MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUMMARY_CLASS =
  "march-intel-remarch-residual-deepest-deepest-deepest-summary";

export function formatMarchIntelRemarchResidualDeepestDeepestDeepestSummary(
  prefill: MarchIntelRemarchPrefill,
  troopMarginHint?: string | null,
): string {
  const deepestDeepestDeeper = formatMarchIntelRemarchResidualDeepestDeepestDeeperSummary(
    prefill,
    troopMarginHint,
  );
  return `巩固再加深四层 · ${deepestDeepestDeeper}`;
}

export function syncMarchIntelRemarchResidualDeepestDeepestDeepestSummary(
  formRoot: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = formRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUMMARY_ROLE}"]`,
  );
  if (!el) return;
  if (!line?.trim()) {
    el.textContent = "";
    el.classList.add("hidden");
    el.classList.remove(MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUMMARY_CLASS);
    return;
  }
  el.textContent = line;
  el.classList.remove("hidden");
  el.classList.add(MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUMMARY_CLASS);
}

export function clearMarchIntelRemarchResidualDeepestDeepestDeepestSummary(
  formRoot: ParentNode | null | undefined,
): void {
  syncMarchIntelRemarchResidualDeepestDeepestDeepestSummary(formRoot, null);
}

/**
 * 军情行「再出征」：CLIENT-338 预填 + 只读 **巩固再加深四层**摘要（CLIENT-253 底栏余量 hint 软依赖；**无** CancelMarch）。
 */
export function prefillMarchFormFromIntelResidualDeepestDeepestDeepest(
  formRoot: ParentNode | null | undefined,
  march: MarchSummary,
  feedback?: MarchFormInlineFeedbackContext,
  storage?: Pick<Storage, "setItem"> | null,
  troopMarginResidual?: ReturnType<typeof formatMarchFormTroopMarginResidualLine> | null,
): MarchIntelRemarchPrefill | null {
  const prefill = prefillMarchFormFromIntelResidualDeepestDeepestDeeper(
    formRoot,
    march,
    feedback,
    storage,
    troopMarginResidual,
  );
  if (!prefill) return null;

  const marginHint = troopMarginResidual?.line ?? null;
  syncMarchIntelRemarchResidualDeepestDeepestDeepestSummary(
    formRoot,
    formatMarchIntelRemarchResidualDeepestDeepestDeepestSummary(prefill, marginHint),
  );
  return prefill;
}

/** CLIENT-350 软依赖：无军事面板时安全 no-op。 */
export function stubPrefillMarchFormFromIntelResidualDeepestDeepestDeepest(
  formRoot: ParentNode | null | undefined,
): boolean {
  if (
    !formRoot?.querySelector(
      `[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE}"]`,
    )
  ) {
    return false;
  }
  clearMarchIntelRemarchResidualDeepestDeepestDeepestSummary(formRoot);
  return true;
}
