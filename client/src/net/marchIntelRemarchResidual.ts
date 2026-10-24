import type { MarchSummary } from "@/net/militaryFormat";
import {
  applyMarchIntelRemarchPrefillWithFeedback,
  buildMarchIntelRemarchPrefill,
  type MarchIntelRemarchPrefill,
} from "@/net/marchIntelRemarch";
import type { MarchFormInlineFeedbackContext } from "@/net/marchFormSummary";

/** CLIENT-258：军情再出征只读坐标/兵力残余摘要行（与 CLIENT-093 `march-intel-last-troops` 并存）。 */
export const MARCH_INTEL_REMARCH_RESIDUAL_SUMMARY_ROLE = "march-intel-remarch-residual-summary";
export const MARCH_INTEL_REMARCH_RESIDUAL_SUMMARY_CLASS = "march-intel-remarch-residual-summary";

export function formatMarchIntelRemarchResidualSummary(
  prefill: MarchIntelRemarchPrefill,
): string {
  const troopPart = prefill.lastTroopsSummary?.replace(/^上次兵力：/, "") ?? "兵力 —";
  return `再出征只读 · 目标 (${prefill.toX},${prefill.toY}) · ${troopPart}`;
}

export function syncMarchIntelRemarchResidualSummary(
  formRoot: ParentNode | null | undefined,
  line: string | null,
): void {
  const el = formRoot?.querySelector<HTMLElement>(
    `[data-role="${MARCH_INTEL_REMARCH_RESIDUAL_SUMMARY_ROLE}"]`,
  );
  if (!el) return;
  if (!line?.trim()) {
    el.textContent = "";
    el.classList.add("hidden");
    el.classList.remove(MARCH_INTEL_REMARCH_RESIDUAL_SUMMARY_CLASS);
    return;
  }
  el.textContent = line;
  el.classList.remove("hidden");
  el.classList.add(MARCH_INTEL_REMARCH_RESIDUAL_SUMMARY_CLASS);
}

export function clearMarchIntelRemarchResidualSummary(
  formRoot: ParentNode | null | undefined,
): void {
  syncMarchIntelRemarchResidualSummary(formRoot, null);
}

/**
 * 军情行「再出征」：预填目标坐标 + 只读残余摘要（CLIENT-222/238/093 不退化；无 CancelMarch）。
 */
export function prefillMarchFormFromIntelResidual(
  formRoot: ParentNode | null | undefined,
  march: MarchSummary,
  feedback?: MarchFormInlineFeedbackContext,
  storage?: Pick<Storage, "setItem"> | null,
): MarchIntelRemarchPrefill | null {
  const prefill = buildMarchIntelRemarchPrefill(march);
  if (!prefill) return null;
  applyMarchIntelRemarchPrefillWithFeedback(formRoot, prefill, feedback, storage);
  syncMarchIntelRemarchResidualSummary(
    formRoot,
    formatMarchIntelRemarchResidualSummary(prefill),
  );
  return prefill;
}
