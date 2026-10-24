import type { AssetLoader } from "@/engine/AssetLoader";
import {
  PANEL_ASSET_DAILY,
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_HERO,
  PANEL_ASSET_QUEUE,
  PANEL_ASSET_RANK,
  PANEL_ASSET_SHOP,
  PANEL_ASSET_WORLD,
} from "@/engine/artPanelSkin";
import { PANEL_FILTER_CHIP_BAR_CLASS } from "@/engine/panelFilterChipBarClass";
import { TOOLBAR_HEIGHT } from "@/engine/mainCitySlots";
import {
  MINIMAP_NARROW_EXPANDED_LAYOUT_RECT,
  resolveMinimapExpandedLayoutRect,
} from "@/ui/worldMinimap";

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-155 / CLIENT-163. */
export const WAVE32_MAIN_CITY_BUILD_HERO_SHOP_DAILY_WORLD_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-171: wave:32 主城建造·队列·将领招募·商城·日常 chain·世界格点 at 1280×720.
 * Soft-deps CLIENT-164～170 wire DOM into these selectors.
 */
export const CLIENT_171_NARROW_MANIFEST_CENTER_PANEL_IDS = [
  "building",
  "queue",
  "hero",
  "shop",
  "daily",
  "rank",
  "world",
] as const;

export type Client171NarrowManifestCenterPanelId =
  (typeof CLIENT_171_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

/** CLIENT-164: next-level build/upgrade cost preview vs wallet (read-only). */
export const RESOURCE_DEFICIT_CLASS = "resource-deficit";
export const BUILD_UPGRADE_COST_LINE_CLASS = "building-upgrade-preview";
export const BUILD_UPGRADE_COST_LINE_SELECTOR = `.${BUILD_UPGRADE_COST_LINE_CLASS}`;

/** CLIENT-164: queue row ETA + thin progress bar (`QueuePanels` DOM). */
export const QUEUE_REMAINING_PROGRESS_CLASS = "queue-row-progress";
export const QUEUE_REMAINING_PROGRESS_FILL_CLASS = "queue-row-progress-fill";
export const QUEUE_REMAINING_PROGRESS_SELECTOR = `.${QUEUE_REMAINING_PROGRESS_CLASS}`;

/** CLIENT-196: queue row ETA line + progress bar scan (`QueuePanels` DOM). */
export {
  QUEUE_ROW_ETA_LINE_CLASS,
  QUEUE_ROW_PROGRESS_BAR_CLASS,
} from "@/net/queueRemainingEtaLine";

/** CLIENT-165: hero detail cultivation item gap vs bag snapshot. */
export const HERO_UPGRADE_ITEM_GAP_CLASS = "hero-upgrade-item-gap";
export const HERO_UPGRADE_ITEM_GAP_SELECTOR = `[data-role="hero-upgrade-item-gap"]`;

/** CLIENT-166: recruit template wallet sweep on list/detail secondary line. */
export const RECRUIT_WALLET_SWEEP_SECONDARY_CLASS = "recruit-afford-secondary";
export const RECRUIT_COST_DEFICIT_CLASS = "recruit-cost-deficit";
export { RECRUIT_SCROLL_ANCHOR_SESSION_KEY } from "@/net/recruitScrollAnchor";

/** CLIENT-183: recruit submit inline feedback on preview / wallet sweep line. */
export {
  RECRUIT_SUBMITTING_CLASS,
  RECRUIT_SUCCESS_PULSE_CLASS,
} from "@/net/recruitSubmitFeedback";

/** CLIENT-168: dual-board list row → hero detail deep link control. */
export const RANK_OPEN_HERO_DETAIL_ACTION = "rank-view-hero";
export const RANK_VIEW_HERO_LINK_CLASS = "rank-view-hero-link";
export const RANK_OPEN_HERO_DETAIL_SELECTOR = `[data-action="${RANK_OPEN_HERO_DETAIL_ACTION}"]`;
export { LEADERBOARD_RETURN_SCROLL_SESSION_KEY } from "@/net/leaderboardReturnScroll";

/** CLIENT-169: multi chain_id tabs above daily quest filters. */
export const DAILY_CHAIN_TAB_SESSION_KEY = "daily-chain-tab-v1";
export const DAILY_CHAIN_TAB_BAR_CLASS = "daily-chain-tabs";
export const DAILY_CHAIN_TAB_CLASS = "daily-chain-tab";
export const DAILY_CHAIN_TAB_BAR_SELECTOR = `.${DAILY_CHAIN_TAB_BAR_CLASS}.${PANEL_FILTER_CHIP_BAR_CLASS}`;

/** CLIENT-170: minimap pick ↔ tile info card mutual highlight. */
export const WORLD_TILE_FOCUS_PULSE_CLASS = "world-tile-focus-pulse";
export const WORLD_TILE_INFO_SELECTOR = '[data-role="world-tile-info"]';
export const WORLD_MINIMAP_NARROW_EXPANDED_LAYOUT_RECT = MINIMAP_NARROW_EXPANDED_LAYOUT_RECT;
export const resolveWave32WorldMinimapExpandedLayoutRect = resolveMinimapExpandedLayoutRect;

export const CLIENT_171_PANEL_ASSET_BY_CENTER_ID: Record<
  Client171NarrowManifestCenterPanelId,
  string
> = {
  building: PANEL_ASSET_DEFAULT,
  queue: PANEL_ASSET_QUEUE,
  hero: PANEL_ASSET_HERO,
  shop: PANEL_ASSET_SHOP,
  daily: PANEL_ASSET_DAILY,
  rank: PANEL_ASSET_RANK,
  world: PANEL_ASSET_WORLD,
};

export const CLIENT_171_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client171NarrowManifestCenterPanelId,
  string
> = {
  building: "building-scroll",
  queue: "queue-scroll",
  hero: "hero-scroll",
  shop: "shop-scroll",
  daily: "daily-scroll",
  rank: "rank-scroll",
  world: "world-scroll",
};

export function panelScrollClearsBottomToolbar(paddingBottomPx: number): boolean {
  return paddingBottomPx >= TOOLBAR_HEIGHT;
}

export function isWave32MainCityBuildHeroShopDailyWorldArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryClient171PanelRoot(
  doc: ParentNode,
  panelId: Client171NarrowManifestCenterPanelId,
): HTMLElement | null {
  if (doc instanceof HTMLElement && doc.dataset.centerPanel === panelId) {
    return doc;
  }
  if (panelId === "building") {
    return doc.querySelector<HTMLElement>(`.building-panel[data-center-panel="building"]`);
  }
  return doc.querySelector<HTMLElement>(`[data-center-panel="${panelId}"]`);
}

/** No-op skin hook; nine-slice wired in MainCityScene / panel components. */
export function mountClient171PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isWave32MainCityBuildHeroShopDailyWorldArtSkinOff(_root)) return;
}

/** CLIENT-167: per-category settlement currency balance beside shop tabs. */
export {
  SHOP_TAB_CURRENCY_SWEEP_CLASS,
  SHOP_TAB_CURRENCY_SWEEP_SELECTOR,
  SHOP_PRICE_VS_WALLET_CLASS,
} from "@/engine/mainCityWave30NarrowManifest";
