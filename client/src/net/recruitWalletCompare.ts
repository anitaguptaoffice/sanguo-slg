import type { ResourceWallet } from "@/net/bootstrapSession";
import type { BagStack } from "@/net/bagState";
import { formatResourceAmount } from "@/net/hudFormat";
import {
  compareRecruitAffordability,
  type RecruitTemplateCost,
} from "@/net/recruitAffordability";

/** 招募面板顶栏只读对比行（CLIENT-215；与 CLIENT-166 列表次行并存）。 */
export const RECRUIT_WALLET_COMPARE_LINE_ROLE = "recruit-wallet-compare-line";
export const RECRUIT_WALLET_COMPARE_LINE_CLASS = "recruit-wallet-compare-line";
export const RECRUIT_WALLET_COMPARE_DEFICIT_CLASS = "recruit-wallet-compare-deficit";

export type RecruitWalletCompareLine = {
  text: string;
  hasDeficit: boolean;
};

function lineMark(sufficient: boolean): string {
  return sufficient ? "✓" : "不足";
}

/**
 * 招募顶栏：模板所需币种 vs HUD 钱包/背包 **并排**只读摘要（需 | 持）。
 * 不发 RecruitHero；与 `formatRecruitWalletSweepLine`（余/需）口径同源。
 */
export function formatRecruitWalletCompareLine(
  wallet: ResourceWallet | undefined,
  templateCost: RecruitTemplateCost | undefined,
  bag: BagStack[] = [],
): RecruitWalletCompareLine | null {
  if (!templateCost) return null;
  const afford = compareRecruitAffordability(wallet, templateCost, bag);
  if (!afford.lines.length) return null;
  const text = afford.lines
    .map((l) => {
      const need =
        l.kind === "resource" ? formatResourceAmount(l.required) : String(l.required);
      const have =
        l.kind === "resource" ? formatResourceAmount(l.available) : String(l.available);
      return `${l.label} 需${need} | 持${have}${lineMark(l.sufficient)}`;
    })
    .join(" · ");
  return { text, hasDeficit: !afford.canAfford };
}

export function syncRecruitWalletCompareLine(
  formRoot: ParentNode | null | undefined,
  compare: RecruitWalletCompareLine | null,
): void {
  const el = formRoot?.querySelector<HTMLElement>(
    `[data-role="${RECRUIT_WALLET_COMPARE_LINE_ROLE}"]`,
  );
  if (!el) return;
  if (!compare?.text) {
    el.textContent = "";
    el.hidden = true;
    el.classList.remove(RECRUIT_WALLET_COMPARE_DEFICIT_CLASS);
    return;
  }
  el.textContent = compare.text;
  el.hidden = false;
  el.classList.toggle(RECRUIT_WALLET_COMPARE_DEFICIT_CLASS, compare.hasDeficit);
}
