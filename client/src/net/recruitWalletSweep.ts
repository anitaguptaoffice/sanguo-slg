import type { ResourceWallet } from "@/net/bootstrapSession";
import type { BagStack } from "@/net/bagState";
import { formatResourceAmount } from "@/net/hudFormat";
import {
  compareRecruitAffordability,
  type RecruitTemplateCost,
} from "@/net/recruitAffordability";

export type RecruitWalletSweepLine = {
  text: string;
  hasDeficit: boolean;
};

function lineMark(sufficient: boolean): string {
  return sufficient ? "✓" : "不足";
}

/**
 * 招募列表次行：HUD wallet/背包 vs 模板消耗（金/将魂碎晶等），只读扫读。
 * 与顶栏 `wallet` 快照一致，不发 RecruitHero。
 */
export function formatRecruitWalletSweepLine(
  wallet: ResourceWallet | undefined,
  templateCost: RecruitTemplateCost,
  bag: BagStack[] = [],
): RecruitWalletSweepLine {
  const afford = compareRecruitAffordability(wallet, templateCost, bag);
  if (!afford.lines.length) {
    return { text: "无资源/道具消耗", hasDeficit: false };
  }
  const text = afford.lines
    .map((l) => {
      const have = l.kind === "resource" ? formatResourceAmount(l.available) : String(l.available);
      const need = l.kind === "resource" ? formatResourceAmount(l.required) : String(l.required);
      return `${l.label} 余${have}/需${need}${lineMark(l.sufficient)}`;
    })
    .join(" · ");
  return { text, hasDeficit: !afford.canAfford };
}
