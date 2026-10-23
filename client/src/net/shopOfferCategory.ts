import type { ShopOfferRow } from "@/net/contentFeedback";

/** 商城客户端分类 tab（只读映射，不改契约）。 */
export type ShopOfferClientCategory = "all" | "resource" | "speedup" | "other";

export const SHOP_CATEGORY_TABS: { id: ShopOfferClientCategory; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "resource", label: "资源" },
  { id: "speedup", label: "加速" },
  { id: "other", label: "其他" },
];

const RESOURCE_ITEM_CFG_IDS = new Set([2001, 2002]);
const SPEEDUP_ITEM_CFG_IDS = new Set([2003]);

function shelfNameHintsResource(shelfName: string): boolean {
  return /资源|粮|木|铁|石|特惠/.test(shelfName);
}

function shelfNameHintsSpeedup(shelfName: string): boolean {
  return /加速|急工|工符/.test(shelfName);
}

/** 按 item_cfg_id 与 shelf_name 只读归类。 */
export function categorizeShopOffer(offer: ShopOfferRow): Exclude<ShopOfferClientCategory, "all"> {
  const id = offer.item_cfg_id ?? 0;
  if (RESOURCE_ITEM_CFG_IDS.has(id)) return "resource";
  if (SPEEDUP_ITEM_CFG_IDS.has(id)) return "speedup";
  const shelf = offer.shelf_name ?? "";
  if (shelfNameHintsSpeedup(shelf)) return "speedup";
  if (shelfNameHintsResource(shelf)) return "resource";
  return "other";
}

export function filterShopOffersByCategory<T extends ShopOfferRow>(
  offers: T[],
  category: ShopOfferClientCategory,
): T[] {
  if (category === "all") return offers;
  return offers.filter((o) => categorizeShopOffer(o) === category);
}

export function countShopOffersByCategory(offers: ShopOfferRow[]): Record<ShopOfferClientCategory, number> {
  const counts: Record<ShopOfferClientCategory, number> = {
    all: offers.length,
    resource: 0,
    speedup: 0,
    other: 0,
  };
  for (const o of offers) {
    counts[categorizeShopOffer(o)] += 1;
  }
  return counts;
}
