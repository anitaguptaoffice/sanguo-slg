import type { ResourceWallet } from "@/net/bootstrapSession";

export type BagStack = { item_cfg_id: number; quantity: number };

type RewardItem = { item_cfg_id?: number; quantity?: number };
type RewardBundle = { items?: RewardItem[]; resources?: ResourceWallet };

export function mergeRewardBundle(
  bag: BagStack[],
  bundle?: RewardBundle | null,
): BagStack[] {
  if (!bundle) return bag;
  let next = [...bag];
  for (const row of bundle.items ?? []) {
    const id = row.item_cfg_id ?? 0;
    const qty = row.quantity ?? 0;
    if (id <= 0 || qty <= 0) continue;
    next = addStack(next, id, qty);
  }
  return next;
}

export function applyUseResult(bag: BagStack[], itemCfgId: number, remaining: number): BagStack[] {
  const next = bag.filter((s) => s.item_cfg_id !== itemCfgId);
  if (remaining > 0) next.push({ item_cfg_id: itemCfgId, quantity: remaining });
  return next.sort((a, b) => a.item_cfg_id - b.item_cfg_id);
}

export function stacksFromList(items: BagStack[]): BagStack[] {
  return [...items]
    .filter((s) => (s.item_cfg_id ?? 0) > 0 && (s.quantity ?? 0) > 0)
    .sort((a, b) => a.item_cfg_id - b.item_cfg_id);
}

/** 将 content.v1.ListPlayerBag 的 items 转为会话背包（全量替换，非增量合并）。 */
export function bagFromListPlayerBagResponse(
  items: { item_cfg_id?: number; quantity?: number }[] | undefined,
): BagStack[] {
  return stacksFromList(
    (items ?? []).map((r) => ({
      item_cfg_id: r.item_cfg_id ?? 0,
      quantity: r.quantity ?? 0,
    })),
  );
}

function addStack(bag: BagStack[], itemCfgId: number, delta: number): BagStack[] {
  const idx = bag.findIndex((s) => s.item_cfg_id === itemCfgId);
  if (idx < 0) {
    return [...bag, { item_cfg_id: itemCfgId, quantity: delta }].sort((a, b) => a.item_cfg_id - b.item_cfg_id);
  }
  const copy = [...bag];
  copy[idx] = { item_cfg_id: itemCfgId, quantity: (copy[idx].quantity ?? 0) + delta };
  return copy;
}

export function mergeWallet(base: ResourceWallet, patch?: ResourceWallet | null): ResourceWallet {
  if (!patch) return base;
  const add = (a: number | undefined, b: number | undefined) => (a ?? 0) + (b ?? 0);
  return {
    food: add(base.food, patch.food),
    wood: add(base.wood, patch.wood),
    iron: add(base.iron, patch.iron),
    stone: add(base.stone, patch.stone),
    gold: add(base.gold, patch.gold),
  };
}
