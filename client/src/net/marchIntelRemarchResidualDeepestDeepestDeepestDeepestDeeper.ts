import type { MarchSummary } from "@/net/militaryFormat";
import type { MarchIntelRemarchPrefill } from "@/net/marchIntelRemarch";
import type { MarchFormInlineFeedbackContext } from "@/net/marchFormSummary";
import { formatMarchFormTroopMarginResidualLine } from "@/net/marchFormTroopMarginResidual";
import {
  formatMarchIntelRemarchResidualDeepestDeepestDeepestDeeperSummary,
  MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE,
  prefillMarchFormFromIntelResidualDeepestDeepestDeepestDeeper,
} from "@/net/marchIntelRemarchResidualDeepestDeepestDeepestDeeper";

/** CLIENT-386：军情再出征只读坐标/兵力 **巩固再加深五层**摘要行（与 CLIENT-370 五层行 **并存**）。 */
export const MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE =
  "march-intel-remarch-residual-deepest-deepest-deepest-deepest-deeper-summary";
export const MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_CLASS =
  "march-intel-remarch-residual-deepest-deepest-deepest-deepest-deeper-summary";

export function formatMarchIntelRemarchResidualDeepestDeepestDeepestDeepestDeeperSummary(
  prefill: MarchIntelRemarchPrefill,
  troopMarginHint?: string | null,
): string {
  const deepestDeepestDeepestDeeper = formatMarchIntelRemarchResidualDeepestDeepestDeepestDeeperSummary(
    prefill,
    troopMarginHint,
  );
  return `巩固再加深五层 · ${deepestDeepestDeepestDeeper}`;
}

export function syncMarchIntelRemarchResidualDeepestDeepestDeepestDeepestDeeperSummary(
  formRoot: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = formRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE}"]`,
  );
  if (!el) return;
  if (!line?.trim()) {
    el.textContent = "";
    el.classList.add("hidden");
    el.classList.remove(MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_CLASS);
    return;
  }
  el.textContent = line;
  el.classList.remove("hidden");
  el.classList.add(MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_CLASS);
}

export function clearMarchIntelRemarchResidualDeepestDeepestDeepestDeepestDeeperSummary(
  formRoot: ParentNode | null | undefined,
): void {
  syncMarchIntelRemarchResidualDeepestDeepestDeepestDeepestDeeperSummary(formRoot, null);
}

/**
 * 军情行「再出征」：CLIENT-370 预填 + 只读 **巩固再加深五层**摘要（CLIENT-253 底栏余量 hint 软依赖；**无** CancelMarch）。
 */
export function prefillMarchFormFromIntelResidualDeepestDeepestDeepestDeepestDeeper(
  formRoot: ParentNode | null | undefined,
  march: MarchSummary,
  feedback?: MarchFormInlineFeedbackContext,
  storage?: Pick<Storage, "setItem"> | null,
  troopMarginResidual?: ReturnType<typeof formatMarchFormTroopMarginResidualLine> | null,
): MarchIntelRemarchPrefill | null {
  const prefill = prefillMarchFormFromIntelResidualDeepestDeepestDeepestDeeper(
    formRoot,
    march,
    feedback,
    storage,
    troopMarginResidual,
  );
  if (!prefill) return null;

  const marginHint = troopMarginResidual?.line ?? null;
  syncMarchIntelRemarchResidualDeepestDeepestDeepestDeepestDeeperSummary(
    formRoot,
    formatMarchIntelRemarchResidualDeepestDeepestDeepestDeepestDeeperSummary(prefill, marginHint),
  );
  return prefill;
}

/** CLIENT-382 软依赖：无军事面板时安全 no-op。 */
export function stubPrefillMarchFormFromIntelResidualDeepestDeepestDeepestDeepestDeeper(
  formRoot: ParentNode | null | undefined,
): boolean {
  if (
    !formRoot?.querySelector(
      `[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SUMMARY_ROLE}"]`,
    )
  ) {
    return false;
  }
  clearMarchIntelRemarchResidualDeepestDeepestDeepestDeepestDeeperSummary(formRoot);
  return true;
}
