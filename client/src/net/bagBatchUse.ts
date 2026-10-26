import { canUseBagItem, bagUseCapabilityHint } from "./bagUseCapability";
import type { BagStack } from "@/net/bagState";
import type { ContentFormValidationResult } from "@/net/contentFormValidation";
import { itemLabel } from "@/net/contentFormat";

/** 单次批量 UI 最多勾选格数（逐次 UseConsumable count=1）。 */
export const BATCH_USE_SLOT_CAP = 20;

export function isBatchUseEligibleItem(itemCfgId: number): boolean {
  return canUseBagItem(itemCfgId);
}

export type BatchUseStepResult = { ok: true } | { ok: false; message: string };

export type BatchUseSummary = {
  successCount: number;
  failureCount: number;
  /** 面板 `bag-feedback` 汇总文案 */
  summaryText: string;
  /** 末条失败 CLIENT-067 口径，供 `bag-form-error` */
  lastError: string | null;
};

/** 批量使用前校验（不发 RPC）。 */
export function validateBatchUseConsumableSlots(input: {
  itemCfgId: number;
  slotCount: number;
  bag: BagStack[];
}): ContentFormValidationResult {
  const errors: string[] = [];
  const { itemCfgId, slotCount, bag } = input;

  if (!isBatchUseEligibleItem(itemCfgId)) {
    errors.push(`${itemLabel(itemCfgId)} 不支持批量使用；${bagUseCapabilityHint(itemCfgId)}`);
  }

  if (!Number.isFinite(slotCount) || !Number.isInteger(slotCount) || slotCount <= 0) {
    errors.push("请勾选至少 1 格");
  } else if (slotCount > BATCH_USE_SLOT_CAP) {
    errors.push(`单次最多批量 ${BATCH_USE_SLOT_CAP} 格`);
  }

  const qty = bag.find((s) => s.item_cfg_id === itemCfgId)?.quantity ?? 0;
  if (qty <= 0) {
    errors.push(`背包中没有 ${itemLabel(itemCfgId)}`);
  } else if (slotCount > qty) {
    errors.push(`勾选格数超过持有数量（当前 ×${qty}）`);
  }

  if (errors.length) {
    return { ok: false, message: errors.join("；") };
  }
  return { ok: true };
}

/** 汇总顺序 UseConsumable 结果（单测覆盖）。 */
export function summarizeBatchUseConsumableResults(results: BatchUseStepResult[]): BatchUseSummary {
  let successCount = 0;
  let failureCount = 0;
  let lastError: string | null = null;
  for (const r of results) {
    if (r.ok) successCount += 1;
    else {
      failureCount += 1;
      lastError = r.message;
    }
  }
  const parts: string[] = [];
  parts.push(`批量使用：成功 ${successCount} 次`);
  if (failureCount > 0) {
    parts.push(`失败 ${failureCount} 次`);
    if (lastError) parts.push(`末条 ${lastError}`);
  }
  return {
    successCount,
    failureCount,
    summaryText: parts.join(" · "),
    lastError: failureCount > 0 ? lastError : null,
  };
}
