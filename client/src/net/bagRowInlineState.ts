import type { BagStack } from "@/net/bagState";
import { formatBagStackQty } from "@/net/bagCategory";
import { formatBagItemCfgSummary } from "@/net/bagItemCfgSummary";

/** CLIENT-194：选中/使用堆叠行时行内态（数量 + CLIENT-175 cfg 摘要）。 */
export const BAG_ROW_INLINE_STATE_CLASS = "bag-row-inline-state";

/** 合并堆叠数量与 cfg 次行摘要，供 `bag-row-inline-state` 只读扫读。 */
export function formatBagRowInlineState(row: BagStack): string | null {
  const summary = formatBagItemCfgSummary(row);
  if (!summary) return null;
  return `${formatBagStackQty(row.quantity)} · ${summary}`;
}
