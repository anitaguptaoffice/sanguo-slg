import type { BagStack } from "@/net/bagState";
import {
  readBagCategoryScrollState,
  updateBagCategoryTabInScrollState,
  BAG_CATEGORY_TAB_SESSION_KEY,
} from "@/net/bagCategoryScroll";
import { parseBagCategoryTabSessionValue } from "@/net/bagCategoryTabParse";
import { HERO_CULTIVATION_CONSUMABLE_CFG_IDS } from "@/net/heroMailState";

/** sessionStorage：背包分类 tab（CLIENT-153，仅客户端过滤 ListPlayerBag 快照）。 */
export { BAG_CATEGORY_TAB_SESSION_KEY };

/** 背包客户端分类 tab（与 DATA-001 子集道具只读映射）。 */
export type BagClientCategory = "all" | "consumable" | "cultivation";

export const BAG_CATEGORY_TABS: { id: BagClientCategory; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "consumable", label: "消耗品" },
  { id: "cultivation", label: "养成" },
];

const CONSUMABLE_ITEM_CFG_IDS = new Set([2001, 2002, 2003, 2020]);
const CULTIVATION_ITEM_CFG_IDS = new Set<number>([
  2004,
  2005,
  2006,
  ...HERO_CULTIVATION_CONSUMABLE_CFG_IDS,
]);

export function bagCategoryTabLabel(category: BagClientCategory): string {
  const tab = BAG_CATEGORY_TABS.find((t) => t.id === category);
  return tab?.label ?? category;
}

export { parseBagCategoryTabSessionValue } from "@/net/bagCategoryTabParse";

export function readBagCategoryTabSession(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): BagClientCategory {
  try {
    return readBagCategoryScrollState(storage).tab;
  } catch {
    return "all";
  }
}

export function writeBagCategoryTabSession(
  category: BagClientCategory,
  storage: Pick<Storage, "setItem" | "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  try {
    updateBagCategoryTabInScrollState(category, storage);
  } catch {
    /* quota / private mode */
  }
}

/** 按 item_cfg_id 只读归类（未知 id 归入消耗品 tab，仍可在「全部」看见）。 */
export function categorizeBagStackRow(
  row: BagStack,
): Exclude<BagClientCategory, "all"> {
  const id = row.item_cfg_id ?? 0;
  if (CULTIVATION_ITEM_CFG_IDS.has(id)) return "cultivation";
  if (CONSUMABLE_ITEM_CFG_IDS.has(id)) return "consumable";
  return "consumable";
}

export function filterBagRowsByCategory<T extends BagStack>(
  rows: T[],
  category: BagClientCategory,
): T[] {
  if (category === "all") return rows;
  return rows.filter((row) => categorizeBagStackRow(row) === category);
}

export function countBagRowsByCategory(rows: BagStack[]): Record<BagClientCategory, number> {
  const counts: Record<BagClientCategory, number> = {
    all: rows.length,
    consumable: 0,
    cultivation: 0,
  };
  for (const row of rows) {
    counts[categorizeBagStackRow(row)] += 1;
  }
  return counts;
}

/** 列表行堆叠数量（`bag-stack-qty` + tabular-nums）。 */
export function formatBagStackQty(quantity: number | undefined): string {
  const q = Math.max(0, Math.floor(Number(quantity) || 0));
  return `×${q}`;
}

export function bagCategoryListEmptyMessage(
  category: BagClientCategory,
  hasAnyStacks: boolean,
): string {
  if (!hasAnyStacks) {
    return "背包为空，可打开底栏「商城」购买或完成「日常」领奖获取道具";
  }
  if (category === "all") {
    return "背包为空，可打开底栏「商城」购买或完成「日常」领奖获取道具";
  }
  return `（当前「${bagCategoryTabLabel(category)}」分类无匹配道具）`;
}
