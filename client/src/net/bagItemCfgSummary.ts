import type { BagStack } from "@/net/bagState";
import { HERO_CULTIVATION_CONSUMABLE_CFG_IDS } from "@/net/heroMailState";

/** 本地 cfg 子集（与 DATA-001 / catalog.json 只读对齐，无 content RPC）。 */
type LocalItemCfg = { maxStack: number; brief?: string };

const CONSUMABLE_ITEM_CFG_IDS = new Set([2001, 2002, 2003, 2020]);
const CULTIVATION_ITEM_CFG_IDS = new Set<number>([
  2004,
  2005,
  2006,
  ...HERO_CULTIVATION_CONSUMABLE_CFG_IDS,
]);

const LOCAL_ITEM_CFG: Record<number, LocalItemCfg> = {
  2001: { maxStack: 99, brief: "立刻充实粮栈" },
  2002: { maxStack: 99, brief: "充实木栈" },
  2003: { maxStack: 999, brief: "催工五刻" },
  2004: { maxStack: 10, brief: "标准招募一次" },
  2005: { maxStack: 50, brief: "征召步兵" },
  2006: { maxStack: 50, brief: "骑队出营" },
  2017: { maxStack: 999, brief: "将领经验" },
  2020: { maxStack: 99, brief: "出征战备" },
};

export type BagItemCfgDisplayKind = "养成" | "消耗" | "其他";

export function bagItemCfgDisplayKind(itemCfgId: number): BagItemCfgDisplayKind {
  if (CULTIVATION_ITEM_CFG_IDS.has(itemCfgId)) return "养成";
  if (CONSUMABLE_ITEM_CFG_IDS.has(itemCfgId)) return "消耗";
  return "其他";
}

export function lookupBagItemLocalCfg(itemCfgId: number): LocalItemCfg | null {
  return LOCAL_ITEM_CFG[itemCfgId] ?? null;
}

/** 背包堆叠行次行：类型 + 堆叠/上限或 cfg 简述（ListPlayerBag 数量 + 本地映射）。 */
export function formatBagItemCfgSummary(row: BagStack): string {
  const itemCfgId = row.item_cfg_id ?? 0;
  const kind = bagItemCfgDisplayKind(itemCfgId);
  const qty = Math.max(0, Math.floor(Number(row.quantity) || 0));
  const meta = lookupBagItemLocalCfg(itemCfgId);
  if (meta?.brief) {
    const cap = meta.maxStack > 0 ? ` · 堆叠 ${qty}/${meta.maxStack}` : "";
    return `${kind} · ${meta.brief}${cap}`;
  }
  if (meta?.maxStack) {
    return `${kind} · 堆叠 ${qty}/${meta.maxStack}`;
  }
  if (qty > 0) {
    return `${kind} · 持 ${qty}`;
  }
  return kind;
}
