import type { MarchSummary } from "@/net/militaryFormat";
import type { MarchIntelRemarchPrefill } from "@/net/marchIntelRemarch";
import type { MarchFormInlineFeedbackContext } from "@/net/marchFormSummary";
import { formatMarchFormTroopMarginResidualLine } from "@/net/marchFormTroopMarginResidual";
import {
  formatMarchIntelRemarchResidualDeepestSummary,
  MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_SUMMARY_ROLE,
  prefillMarchFormFromIntelResidualDeepest,
} from "@/net/marchIntelRemarchResidualDeepest";

/** CLIENT-322：军情再出征只读坐标/兵力 **巩固再加深二层**摘要行（与 CLIENT-306 最深行 **并存**）。 */
export const MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPER_SUMMARY_ROLE =
  "march-intel-remarch-residual-deepest-deeper-summary";
export const MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPER_SUMMARY_CLASS =
  "march-intel-remarch-residual-deepest-deeper-summary";

export function formatMarchIntelRemarchResidualDeepestDeeperSummary(
  prefill: MarchIntelRemarchPrefill,
  troopMarginHint?: string | null,
): string {
  const deepest = formatMarchIntelRemarchResidualDeepestSummary(prefill, troopMarginHint);
  return `巩固再加深二层 · ${deepest}`;
}

export function syncMarchIntelRemarchResidualDeepestDeeperSummary(
  formRoot: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = formRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPER_SUMMARY_ROLE}"]`,
  );
  if (!el) return;
  if (!line?.trim()) {
    el.textContent = "";
    el.classList.add("hidden");
    el.classList.remove(MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPER_SUMMARY_CLASS);
    return;
  }
  el.textContent = line;
  el.classList.remove("hidden");
  el.classList.add(MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_DEEPER_SUMMARY_CLASS);
}

export function clearMarchIntelRemarchResidualDeepestDeeperSummary(
  formRoot: ParentNode | null | undefined,
): void {
  syncMarchIntelRemarchResidualDeepestDeeperSummary(formRoot, null);
}

/**
 * 军情行「再出征」：CLIENT-306 预填 + 只读 **巩固再加深二层**摘要（CLIENT-253 底栏余量 hint 软依赖；**无** CancelMarch）。
 */
export function prefillMarchFormFromIntelResidualDeepestDeeper(
  formRoot: ParentNode | null | undefined,
  march: MarchSummary,
  feedback?: MarchFormInlineFeedbackContext,
  storage?: Pick<Storage, "setItem"> | null,
  troopMarginResidual?: ReturnType<typeof formatMarchFormTroopMarginResidualLine> | null,
): MarchIntelRemarchPrefill | null {
  const prefill = prefillMarchFormFromIntelResidualDeepest(
    formRoot,
    march,
    feedback,
    storage,
    troopMarginResidual,
  );
  if (!prefill) return null;

  const marginHint = troopMarginResidual?.line ?? null;
  syncMarchIntelRemarchResidualDeepestDeeperSummary(
    formRoot,
    formatMarchIntelRemarchResidualDeepestDeeperSummary(prefill, marginHint),
  );
  return prefill;
}

/** CLIENT-317 软依赖：无军事面板时安全 no-op。 */
export function stubPrefillMarchFormFromIntelResidualDeepestDeeper(
  formRoot: ParentNode | null | undefined,
): boolean {
  if (!formRoot?.querySelector(`[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_SUMMARY_ROLE}"]`)) {
    return false;
  }
  clearMarchIntelRemarchResidualDeepestDeeperSummary(formRoot);
  return true;
}
