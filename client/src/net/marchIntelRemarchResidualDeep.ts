import type { MarchSummary } from "@/net/militaryFormat";
import type { MarchIntelRemarchPrefill } from "@/net/marchIntelRemarch";
import type { MarchFormInlineFeedbackContext } from "@/net/marchFormSummary";
import {
  formatMarchIntelRemarchResidualSummary,
  MARCH_INTEL_REMARCH_RESIDUAL_SUMMARY_ROLE,
  prefillMarchFormFromIntelResidual,
  syncMarchIntelRemarchResidualSummary,
} from "@/net/marchIntelRemarchResidual";
import { formatMarchFormTroopMarginResidualLine } from "@/net/marchFormTroopMarginResidual";

/** CLIENT-274：军情再出征只读坐标/兵力 **巩固加深**摘要行（与 CLIENT-258 残余行 **并存**）。 */
export const MARCH_INTEL_REMARCH_RESIDUAL_DEEP_SUMMARY_ROLE =
  "march-intel-remarch-residual-deep-summary";
export const MARCH_INTEL_REMARCH_RESIDUAL_DEEP_SUMMARY_CLASS =
  "march-intel-remarch-residual-deep-summary";

export function formatMarchIntelRemarchResidualDeepSummary(
  prefill: MarchIntelRemarchPrefill,
  troopMarginHint?: string | null,
): string {
  const residual = formatMarchIntelRemarchResidualSummary(prefill);
  const marginPart = troopMarginHint?.trim() ? ` · ${troopMarginHint.trim()}` : "";
  return `巩固加深 · ${residual}${marginPart}`;
}

export function syncMarchIntelRemarchResidualDeepSummary(
  formRoot: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = formRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_DEEP_SUMMARY_ROLE}"]`,
  );
  if (!el) return;
  if (!line?.trim()) {
    el.textContent = "";
    el.classList.add("hidden");
    el.classList.remove(MARCH_INTEL_REMARCH_RESIDUAL_DEEP_SUMMARY_CLASS);
    return;
  }
  el.textContent = line;
  el.classList.remove("hidden");
  el.classList.add(MARCH_INTEL_REMARCH_RESIDUAL_DEEP_SUMMARY_CLASS);
}

export function clearMarchIntelRemarchResidualDeepSummary(
  formRoot: ParentNode | null | undefined,
): void {
  syncMarchIntelRemarchResidualDeepSummary(formRoot, null);
}

/**
 * 军情行「再出征」：CLIENT-258 预填 + 只读 **加深**摘要（CLIENT-253 底栏余量 hint 软依赖；**无** CancelMarch）。
 */
export function prefillMarchFormFromIntelResidualDeep(
  formRoot: ParentNode | null | undefined,
  march: MarchSummary,
  feedback?: MarchFormInlineFeedbackContext,
  storage?: Pick<Storage, "setItem"> | null,
  troopMarginResidual?: ReturnType<typeof formatMarchFormTroopMarginResidualLine> | null,
): MarchIntelRemarchPrefill | null {
  const prefill = prefillMarchFormFromIntelResidual(formRoot, march, feedback, storage);
  if (!prefill) return null;

  const residualLine = formatMarchIntelRemarchResidualSummary(prefill);
  syncMarchIntelRemarchResidualSummary(formRoot, residualLine);

  const marginHint = troopMarginResidual?.line ?? null;
  syncMarchIntelRemarchResidualDeepSummary(
    formRoot,
    formatMarchIntelRemarchResidualDeepSummary(prefill, marginHint),
  );
  return prefill;
}

/** CLIENT-269 软依赖：无军事面板时安全 no-op。 */
export function stubPrefillMarchFormFromIntelResidualDeep(
  formRoot: ParentNode | null | undefined,
): boolean {
  if (!formRoot?.querySelector(`[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_SUMMARY_ROLE}"]`)) {
    return false;
  }
  clearMarchIntelRemarchResidualDeepSummary(formRoot);
  return true;
}
