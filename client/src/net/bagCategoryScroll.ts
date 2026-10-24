import type { BagClientCategory } from "@/net/bagCategory";
import { parseBagCategoryTabSessionValue } from "@/net/bagCategoryTabParse";

/** 与 `bagCategory.BAG_CATEGORY_TAB_SESSION_KEY` 同键（tab + 各分类 scrollTop）。 */
export const BAG_CATEGORY_TAB_SESSION_KEY = "bag-category-tab-v1";

const CATEGORY_KEYS: readonly BagClientCategory[] = ["all", "consumable", "cultivation"];

export type BagCategoryScrollState = {
  tab: BagClientCategory;
  scrollTops: Partial<Record<BagClientCategory, number>>;
};

/** sessionStorage `bag-category-tab-v1`：当前 tab + 各分类 scrollTop（CLIENT-210）。 */
export function serializeBagCategoryScrollState(state: BagCategoryScrollState): string {
  const scrollTops: Record<BagClientCategory, number> = { all: 0, consumable: 0, cultivation: 0 };
  for (const key of CATEGORY_KEYS) {
    const v = state.scrollTops[key];
    if (v != null && Number.isFinite(v) && v >= 0) scrollTops[key] = Math.trunc(v);
  }
  return JSON.stringify({ tab: state.tab, scrollTops });
}

export function parseBagCategoryScrollState(
  raw: string | null | undefined,
): BagCategoryScrollState | null {
  if (raw == null || raw === "") return null;
  const legacyTab = parseBagCategoryTabSessionValue(raw);
  if (legacyTab) {
    return { tab: legacyTab, scrollTops: {} };
  }
  try {
    const parsed = JSON.parse(raw) as { tab?: unknown; scrollTops?: unknown };
    const tab =
      parseBagCategoryTabSessionValue(
        typeof parsed.tab === "string" ? parsed.tab : String(parsed.tab ?? ""),
      ) ?? "all";
    const scrollTops: Partial<Record<BagClientCategory, number>> = {};
    if (parsed.scrollTops && typeof parsed.scrollTops === "object") {
      const map = parsed.scrollTops as Record<string, unknown>;
      for (const key of CATEGORY_KEYS) {
        const v = Number(map[key]);
        if (Number.isFinite(v) && v >= 0) scrollTops[key] = Math.trunc(v);
      }
    }
    return { tab, scrollTops };
  } catch {
    return null;
  }
}

export function readBagCategoryScrollState(
  storage: Pick<Storage, "getItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): BagCategoryScrollState {
  try {
    return (
      parseBagCategoryScrollState(storage?.getItem(BAG_CATEGORY_TAB_SESSION_KEY) ?? null) ?? {
        tab: "all",
        scrollTops: {},
      }
    );
  } catch {
    return { tab: "all", scrollTops: {} };
  }
}

export function writeBagCategoryScrollState(
  state: BagCategoryScrollState,
  storage: Pick<Storage, "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  const validated = parseBagCategoryScrollState(serializeBagCategoryScrollState(state));
  if (!validated) return;
  try {
    storage?.setItem(BAG_CATEGORY_TAB_SESSION_KEY, serializeBagCategoryScrollState(validated));
  } catch {
    /* quota / private mode */
  }
}

export function scrollTopForBagCategory(
  state: BagCategoryScrollState,
  category: BagClientCategory,
): number {
  const v = state.scrollTops[category];
  return v != null && Number.isFinite(v) && v >= 0 ? Math.trunc(v) : 0;
}

export function updateBagCategoryScrollTop(
  category: BagClientCategory,
  scrollTop: number,
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  if (!Number.isFinite(scrollTop) || scrollTop < 0) return;
  const state = readBagCategoryScrollState(storage);
  state.scrollTops[category] = Math.trunc(scrollTop);
  writeBagCategoryScrollState(state, storage);
}

export function updateBagCategoryTabInScrollState(
  tab: BagClientCategory,
  storage: Pick<Storage, "getItem" | "setItem"> | null = typeof sessionStorage !== "undefined"
    ? sessionStorage
    : null,
): void {
  const state = readBagCategoryScrollState(storage);
  state.tab = tab;
  writeBagCategoryScrollState(state, storage);
}

export function bagPanelScrollEl(panel: ParentNode | null | undefined): HTMLElement | null {
  return panel?.querySelector<HTMLElement>('[data-role="bag-scroll"]') ?? null;
}

export function readBagPanelScrollTop(panel: ParentNode | null | undefined): number {
  const el = bagPanelScrollEl(panel);
  const top = el?.scrollTop ?? 0;
  return Number.isFinite(top) && top >= 0 ? Math.trunc(top) : 0;
}

export function applyBagPanelScrollTop(
  panel: ParentNode | null | undefined,
  scrollTop: number,
): void {
  const el = bagPanelScrollEl(panel);
  if (!el || !Number.isFinite(scrollTop) || scrollTop < 0) return;
  el.scrollTop = Math.trunc(scrollTop);
}
