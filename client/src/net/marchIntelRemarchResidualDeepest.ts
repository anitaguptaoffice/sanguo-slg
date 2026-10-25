import type { MarchSummary } from "@/net/militaryFormat";
import type { MarchIntelRemarchPrefill } from "@/net/marchIntelRemarch";
import type { MarchFormInlineFeedbackContext } from "@/net/marchFormSummary";
import { formatMarchFormTroopMarginResidualLine } from "@/net/marchFormTroopMarginResidual";
import {
  formatMarchIntelRemarchResidualDeeperSummary,
  MARCH_INTEL_REMARCH_RESIDUAL_DEEPER_SUMMARY_ROLE,
  prefillMarchFormFromIntelResidualDeeper,
} from "@/net/marchIntelRemarchResidualDeeper";

/** CLIENT-306：军情再出征只读坐标/兵力 **巩固再加深一层**摘要行（与 CLIENT-290 更深行 **并存**）。 */
export const MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_SUMMARY_ROLE =
  "march-intel-remarch-residual-deepest-summary";
export const MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_SUMMARY_CLASS =
  "march-intel-remarch-residual-deepest-summary";

export function formatMarchIntelRemarchResidualDeepestSummary(
  prefill: MarchIntelRemarchPrefill,
  troopMarginHint?: string | null,
): string {
  const deeper = formatMarchIntelRemarchResidualDeeperSummary(prefill, troopMarginHint);
  return `巩固再加深一层 · ${deeper}`;
}

export function syncMarchIntelRemarchResidualDeepestSummary(
  formRoot: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = formRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_SUMMARY_ROLE}"]`,
  );
  if (!el) return;
  if (!line?.trim()) {
    el.textContent = "";
    el.classList.add("hidden");
    el.classList.remove(MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_SUMMARY_CLASS);
    return;
  }
  el.textContent = line;
  el.classList.remove("hidden");
  el.classList.add(MARCH_INTEL_REMARCH_RESIDUAL_DEEPEST_SUMMARY_CLASS);
}

export function clearMarchIntelRemarchResidualDeepestSummary(
  formRoot: ParentNode | null | undefined,
): void {
  syncMarchIntelRemarchResidualDeepestSummary(formRoot, null);
}

/**
 * 军情行「再出征」：CLIENT-290 预填 + 只读 **巩固再加深一层**摘要（CLIENT-253 底栏余量 hint 软依赖；**无** CancelMarch）。
 */
export function prefillMarchFormFromIntelResidualDeepest(
  formRoot: ParentNode | null | undefined,
  march: MarchSummary,
  feedback?: MarchFormInlineFeedbackContext,
  storage?: Pick<Storage, "setItem"> | null,
  troopMarginResidual?: ReturnType<typeof formatMarchFormTroopMarginResidualLine> | null,
): MarchIntelRemarchPrefill | null {
  const prefill = prefillMarchFormFromIntelResidualDeeper(
    formRoot,
    march,
    feedback,
    storage,
    troopMarginResidual,
  );
  if (!prefill) return null;

  const marginHint = troopMarginResidual?.line ?? null;
  syncMarchIntelRemarchResidualDeepestSummary(
    formRoot,
    formatMarchIntelRemarchResidualDeepestSummary(prefill, marginHint),
  );
  return prefill;
}

/** CLIENT-301 软依赖：无军事面板时安全 no-op。 */
export function stubPrefillMarchFormFromIntelResidualDeepest(
  formRoot: ParentNode | null | undefined,
): boolean {
  if (!formRoot?.querySelector(`[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEPER_SUMMARY_ROLE}"]`)) {
    return false;
  }
  clearMarchIntelRemarchResidualDeepestSummary(formRoot);
  return true;
}
