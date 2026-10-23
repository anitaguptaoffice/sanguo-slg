import type { ResourceWallet } from "@/net/bootstrapSession";
import { previewRecruitCost, type RecruitCostPreview } from "@/net/previewRecruitCost";

export function readTroopRecruitForm(panel: ParentNode): { unitCfgId: number; count: number } {
  const unitEl = panel.querySelector('[data-field="unit"]') as HTMLSelectElement | null;
  const countEl = panel.querySelector('[data-field="recruit-count"]') as HTMLInputElement | null;
  const unitCfgId = Number(unitEl?.value ?? 1);
  const count = Number(countEl?.value ?? 1);
  return { unitCfgId, count };
}

export function setTroopRecruitFormError(panel: ParentNode | null | undefined, message: string | null): void {
  const el = panel?.querySelector('[data-role="troop-recruit-form-error"]');
  if (!el) return;
  if (message?.trim()) {
    el.textContent = message;
    el.classList.remove("hidden");
  } else {
    el.textContent = "";
    el.classList.add("hidden");
  }
}

/** 军事/队列募兵区：只读预览 + 募兵按钮 disabled（不发 RPC）。 */
export function syncTroopRecruitFormPreview(
  panel: ParentNode,
  wallet: ResourceWallet | undefined,
): RecruitCostPreview | null {
  const previewEl = panel.querySelector('[data-role="troop-recruit-preview"]');
  const btn = panel.querySelector<HTMLButtonElement>('[data-action="recruit"]');
  const { unitCfgId, count } = readTroopRecruitForm(panel);
  const preview = previewRecruitCost(unitCfgId, count, wallet);

  if (previewEl) {
    previewEl.textContent = preview?.summaryLine ?? "暂无募兵配置";
  }
  if (btn) {
    btn.disabled = !preview?.canAfford;
  }
  setTroopRecruitFormError(panel, preview?.insufficientHint ?? null);
  return preview;
}
