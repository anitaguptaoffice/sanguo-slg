import type { ResourceWallet } from "@/net/bootstrapSession";
import type { BagStack } from "@/net/bagState";
import { formatRecruitWalletCompareLine } from "@/net/recruitWalletCompare";
import { formatRecruitWalletSweepLine } from "@/net/recruitWalletSweep";
import type { RecruitTemplateCost } from "@/net/recruitAffordability";

/** CLIENT-242：招募顶栏对比行下只读列表口径残余次行（CLIENT-056/215 **不退化**）。 */
export const RECRUIT_WALLET_COMPARE_RESIDUAL_ROLE = "recruit-wallet-compare-residual-line";
export const RECRUIT_WALLET_COMPARE_RESIDUAL_CLASS = "recruit-wallet-compare-residual-line";
export const RECRUIT_WALLET_COMPARE_RESIDUAL_DEFICIT_CLASS =
  "recruit-wallet-compare-residual-deficit";

export type RecruitWalletCompareResidualLine = {
  text: string;
  hasDeficit: boolean;
};

/**
 * 顶栏 `formatRecruitWalletCompareLine`（需|持）与列表 `formatRecruitWalletSweepLine`（余/需）只读对照残余。
 */
export function formatRecruitWalletCompareResidualLine(
  wallet: ResourceWallet | undefined,
  templateCost: RecruitTemplateCost | undefined,
  bag: BagStack[] = [],
): RecruitWalletCompareResidualLine | null {
  if (!templateCost) return null;
  const compare = formatRecruitWalletCompareLine(wallet, templateCost, bag);
  const sweep = formatRecruitWalletSweepLine(wallet, templateCost, bag);
  if (!compare || sweep.text === "无资源/道具消耗") return null;
  const text = `列表口径 ${sweep.text}`;
  return { text, hasDeficit: compare.hasDeficit || sweep.hasDeficit };
}

export function syncRecruitWalletCompareResidualLine(
  formRoot: ParentNode | null | undefined,
  residual: RecruitWalletCompareResidualLine | null,
): void {
  const el = formRoot?.querySelector<HTMLElement>(
    `[data-role="${RECRUIT_WALLET_COMPARE_RESIDUAL_ROLE}"]`,
  );
  if (!el) return;
  if (!residual?.text) {
    el.textContent = "";
    el.hidden = true;
    el.classList.remove(RECRUIT_WALLET_COMPARE_RESIDUAL_DEFICIT_CLASS);
    return;
  }
  el.textContent = residual.text;
  el.hidden = false;
  el.classList.toggle(RECRUIT_WALLET_COMPARE_RESIDUAL_DEFICIT_CLASS, residual.hasDeficit);
}
