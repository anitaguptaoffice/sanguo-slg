import type { AssetLoader } from "@/engine/AssetLoader";
import {
  PANEL_ASSET_BAG,
  PANEL_ASSET_DAILY,
  PANEL_ASSET_HERO,
  PANEL_ASSET_QUEUE,
  PANEL_ASSET_RANK,
  PANEL_ASSET_SHOP,
} from "@/engine/artPanelSkin";
import {
  DAILY_QUEST_PROGRESS_SECONDARY_CLASS,
  PANEL_FILTER_CHIP_BAR_CLASS,
} from "@/engine/filterListNarrowManifest";
import { TOOLBAR_HEIGHT } from "@/engine/mainCitySlots";

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-127 / CLIENT-135 / CLIENT-145. */
export const MAIN_CITY_WAVE30_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-155: wave:30 主城产出·日常·将领·排行 + 背包/商城 tab 行内态 at 1280×720.
 * Soft-deps CLIENT-148/150/151/152/153/154 wire DOM into these selectors.
 */
export const CLIENT_155_NARROW_MANIFEST_CENTER_PANEL_IDS = [
  "queue",
  "daily",
  "hero",
  "rank",
  "bag",
  "shop",
] as const;

export type Client155NarrowManifestCenterPanelId =
  (typeof CLIENT_155_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

/** CLIENT-148: hover/focus/expand production sweep under HUD resource strip. */
export const HUD_RESOURCE_STRIP_SELECTOR = ".hud-resource-strip";
export const HUD_RESOURCE_SWEEP_SELECTOR = ".hud-resource-sweep";

/** CLIENT-059: queue panel top summary line (build/recruit counts). */
export const QUEUE_PANEL_OVERVIEW_CLASS = "queue-panel-overview";
export const QUEUE_PANEL_OVERVIEW_SELECTOR = '[data-role="queue-overview"]';

/** Soft-dep CLIENT-151: hero list filter/sort chip bar (CLIENT-121 styles). */
export const HERO_LIST_FILTER_BAR_SELECTOR = `.hero-list-filters.${PANEL_FILTER_CHIP_BAR_CLASS}`;

/** Soft-dep CLIENT-153: bag category tabs beside list (mirrors shop-category-tabs). */
export const BAG_CATEGORY_TABS_SELECTOR = '[data-role="bag-category-tabs"]';
export const BAG_CATEGORY_TAB_CLASS = "bag-category-tab";

/** Soft-dep CLIENT-154: inline afford hint on shop offer rows. */
export const SHOP_OFFER_AFFORD_INLINE_CLASS = "shop-offer-afford-inline";

/** CLIENT-152: dual-board pinned viewer bar + sticky pin row. */
export const RANK_VIEWER_BAR_CLASS = "rank-viewer-bar";
export const RANK_PIN_ROW_CLASS = "rank-pin-row";
export const RANK_MY_RANK_CHANGED_PULSE_CLASS = "rank-my-rank-changed-pulse";

export const CLIENT_155_PANEL_ASSET_BY_CENTER_ID: Record<
  Client155NarrowManifestCenterPanelId,
  string
> = {
  queue: PANEL_ASSET_QUEUE,
  daily: PANEL_ASSET_DAILY,
  hero: PANEL_ASSET_HERO,
  rank: PANEL_ASSET_RANK,
  bag: PANEL_ASSET_BAG,
  shop: PANEL_ASSET_SHOP,
};

export const CLIENT_155_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client155NarrowManifestCenterPanelId,
  string
> = {
  queue: "queue-scroll",
  daily: "daily-scroll",
  hero: "hero-scroll",
  rank: "rank-scroll",
  bag: "bag-scroll",
  shop: "shop-scroll",
};

export { DAILY_QUEST_PROGRESS_SECONDARY_CLASS };

export function panelScrollClearsBottomToolbar(paddingBottomPx: number): boolean {
  return paddingBottomPx >= TOOLBAR_HEIGHT;
}

export function isMainCityWave30ArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryClient155PanelRoot(
  doc: ParentNode,
  panelId: Client155NarrowManifestCenterPanelId,
): HTMLElement | null {
  if (doc instanceof HTMLElement && doc.dataset.centerPanel === panelId) {
    return doc;
  }
  return doc.querySelector<HTMLElement>(`[data-center-panel="${panelId}"]`);
}

/** No-op skin hook; nine-slice wired in MainCityScene (CLIENT-062/103/095). */
export function mountClient155PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isMainCityWave30ArtSkinOff(_root)) return;
}
