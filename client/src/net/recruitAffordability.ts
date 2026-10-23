import type { ResourceWallet } from "@/net/bootstrapSession";
import { setPanelFormErrorDisplay } from "@/net/contentFormValidation";
import { bagStackQuantity, type BagStack } from "@/net/bagState";
import { itemLabel } from "@/net/contentFormat";
import { formatResourceAmount, WALLET_RESOURCE_KEYS } from "@/net/hudFormat";
import { heroTemplateLabel, type RecruitTemplatePreview } from "@/net/heroMailState";

export type RecruitTemplateCost = {
  recruit_cost?: ResourceWallet;
  recruit_item?: { item_cfg_id?: number; quantity?: number };
};

export type RecruitAffordabilityLine = {
  kind: "resource" | "item";
  label: string;
  required: number;
  available: number;
  sufficient: boolean;
};

export type RecruitAffordabilityResult = {
  lines: RecruitAffordabilityLine[];
  canAfford: boolean;
  /** 不足时中文原因（多项以；连接），可负担时为 null。 */
  insufficientReason: string | null;
};

function resourceLines(
  wallet: ResourceWallet | undefined,
  cost: ResourceWallet | undefined,
): RecruitAffordabilityLine[] {
  const lines: RecruitAffordabilityLine[] = [];
  for (const { key, label } of WALLET_RESOURCE_KEYS) {
    const required = cost?.[key] ?? 0;
    if (required <= 0) continue;
    const available = wallet?.[key] ?? 0;
    lines.push({
      kind: "resource",
      label,
      required,
      available,
      sufficient: available >= required,
    });
  }
  return lines;
}

function itemLine(
  bag: BagStack[] | undefined,
  item?: { item_cfg_id?: number; quantity?: number },
): RecruitAffordabilityLine | null {
  const id = item?.item_cfg_id ?? 0;
  const required = item?.quantity ?? 0;
  if (id <= 0 || required <= 0) return null;
  const available = bagStackQuantity(bag, id);
  return {
    kind: "item",
    label: itemLabel(id),
    required,
    available,
    sufficient: available >= required,
  };
}

function insufficientLineReason(line: RecruitAffordabilityLine): string {
  if (line.kind === "item") {
    return `${line.label}不足（需${line.required}，持${line.available}）`;
  }
  return `${line.label}不足（需${formatResourceAmount(line.required)}，持${formatResourceAmount(line.available)}）`;
}

/** 纯函数：对比 HUD 钱包/背包与招募模板消耗，不发 RecruitHero。 */
export function compareRecruitAffordability(
  wallet: ResourceWallet | undefined,
  templateCost: RecruitTemplateCost,
  bag: BagStack[] = [],
): RecruitAffordabilityResult {
  const lines = [...resourceLines(wallet, templateCost.recruit_cost)];
  const item = itemLine(bag, templateCost.recruit_item);
  if (item) lines.push(item);
  const insufficient = lines.filter((l) => !l.sufficient);
  const canAfford = insufficient.length === 0;
  return {
    lines,
    canAfford,
    insufficientReason: canAfford ? null : insufficient.map(insufficientLineReason).join("；"),
  };
}

export function recruitAffordabilityPrimaryLine(template: RecruitTemplatePreview): string {
  const name = template.template_name?.trim() || heroTemplateLabel(template.template_cfg_id);
  const rarity = template.rarity ?? "?";
  const owned = template.already_owned ? " · 已招募" : "";
  return `${name} · 稀有${rarity}${owned}`;
}

function lineMark(sufficient: boolean): string {
  return sufficient ? "✓" : "不足";
}

/** 次行：消耗 vs 当前 HUD 快照（持/需 + ✓ 或 不足）。 */
export function recruitAffordabilitySecondaryLine(result: RecruitAffordabilityResult): string {
  if (!result.lines.length) return "无资源/道具消耗";
  return result.lines
    .map((l) => {
      const have = l.kind === "resource" ? formatResourceAmount(l.available) : String(l.available);
      const need = l.kind === "resource" ? formatResourceAmount(l.required) : String(l.required);
      return `${l.label} 持${have}/需${need}${lineMark(l.sufficient)}`;
    })
    .join(" · ");
}

export function recruitAffordabilityForTemplate(
  template: RecruitTemplatePreview,
  wallet: ResourceWallet | undefined,
  bag: BagStack[] | undefined,
): {
  primary: string;
  secondary: string;
  result: RecruitAffordabilityResult;
} {
  const result = compareRecruitAffordability(wallet, template, bag ?? []);
  return {
    primary: recruitAffordabilityPrimaryLine(template),
    secondary: recruitAffordabilitySecondaryLine(result),
    result,
  };
}

/** 将领详情区与模板列表共用的对比摘要 HTML 片段。 */
export function formatRecruitAffordabilitySummaryMarkup(
  template: RecruitTemplatePreview,
  wallet: ResourceWallet | undefined,
  bag: BagStack[] | undefined,
): string {
  const { primary, secondary } = recruitAffordabilityForTemplate(template, wallet, bag);
  return `<div class="recruit-afford-summary" data-role="recruit-afford-summary">
  <p class="recruit-afford-primary">${escapeHtml(primary)}</p>
  <p class="recruit-afford-secondary">${escapeHtml(secondary)}</p>
</div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 将领面板招募按钮旁 `march-form-error-sibling` 内联错误区。 */
export function setRecruitAffordabilityErrorDisplay(
  panelRoot: ParentNode | null | undefined,
  message: string | null,
): void {
  setPanelFormErrorDisplay(panelRoot, "recruit", message);
}
