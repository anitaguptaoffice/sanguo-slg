import type { MarchSummary } from "@/net/militaryFormat";
import type { MarchIntelRemarchPrefill } from "@/net/marchIntelRemarch";
import type { MarchFormInlineFeedbackContext } from "@/net/marchFormSummary";
import { formatMarchFormTroopMarginResidualLine } from "@/net/marchFormTroopMarginResidual";
import {
  formatMarchIntelRemarchResidualDeepestDeepestDeepestSummary,
  MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUMMARY_ROLE,
  prefillMarchFormFromIntelResidualDeepestDeepestDeepest,
} from "@/net/marchIntelRemarchResidualDeepestDeepestDeepest";

/** CLIENT-370：军情再出征只读坐标/兵力 **巩固再加深五层**摘要行（与 CLIENT-354 四层行 **并存**）。 */
export const MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE =
  "march-intel-remarch-residual-deepest-deepest-deepest-deeper-summary";
export const MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_CLASS =
  "march-intel-remarch-residual-deepest-deepest-deepest-deeper-summary";

export function formatMarchIntelRemarchResidualDeepestDeepestDeepestDeeperSummary(
  prefill: MarchIntelRemarchPrefill,
  troopMarginHint?: string | null,
): string {
  const deepestDeepestDeepest = formatMarchIntelRemarchResidualDeepestDeepestDeepestSummary(
    prefill,
    troopMarginHint,
  );
  return `巩固再加深五层 · ${deepestDeepestDeepest}`;
}

export function syncMarchIntelRemarchResidualDeepestDeepestDeepestDeeperSummary(
  formRoot: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = formRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE}"]`,
  );
  if (!el) return;
  if (!line?.trim()) {
    el.textContent = "";
    el.classList.add("hidden");
    el.classList.remove(MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_CLASS);
    return;
  }
  el.textContent = line;
  el.classList.remove("hidden");
  el.classList.add(MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_CLASS);
}

export function clearMarchIntelRemarchResidualDeepestDeepestDeepestDeeperSummary(
  formRoot: ParentNode | null | undefined,
): void {
  syncMarchIntelRemarchResidualDeepestDeepestDeepestDeeperSummary(formRoot, null);
}

/**
 * 军情行「再出征」：CLIENT-354 预填 + 只读 **巩固再加深五层**摘要（CLIENT-253 底栏余量 hint 软依赖；**无** CancelMarch）。
 */
export function prefillMarchFormFromIntelResidualDeepestDeepestDeepestDeeper(
  formRoot: ParentNode | null | undefined,
  march: MarchSummary,
  feedback?: MarchFormInlineFeedbackContext,
  storage?: Pick<Storage, "setItem"> | null,
  troopMarginResidual?: ReturnType<typeof formatMarchFormTroopMarginResidualLine> | null,
): MarchIntelRemarchPrefill | null {
  const prefill = prefillMarchFormFromIntelResidualDeepestDeepestDeepest(
    formRoot,
    march,
    feedback,
    storage,
    troopMarginResidual,
  );
  if (!prefill) return null;

  const marginHint = troopMarginResidual?.line ?? null;
  syncMarchIntelRemarchResidualDeepestDeepestDeepestDeeperSummary(
    formRoot,
    formatMarchIntelRemarchResidualDeepestDeepestDeepestDeeperSummary(prefill, marginHint),
  );
  return prefill;
}

/** CLIENT-366 软依赖：无军事面板时安全 no-op。 */
export function stubPrefillMarchFormFromIntelResidualDeepestDeepestDeepestDeeper(
  formRoot: ParentNode | null | undefined,
): boolean {
  if (
    !formRoot?.querySelector(
      `[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUMMARY_ROLE}"]`,
    )
  ) {
    return false;
  }
  clearMarchIntelRemarchResidualDeepestDeepestDeepestDeeperSummary(formRoot);
  return true;
}
