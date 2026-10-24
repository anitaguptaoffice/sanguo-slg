import type { AssetLoader } from "@/engine/AssetLoader";
import {
  PANEL_ASSET_BAG,
  PANEL_ASSET_BATTLE_REPORT,
  PANEL_ASSET_DAILY,
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_MARCH,
  PANEL_ASSET_MILITARY,
  PANEL_ASSET_SHOP,
  PANEL_ASSET_WORLD,
} from "@/engine/artPanelSkin";
import { TOOLBAR_HEIGHT } from "@/engine/mainCitySlots";
import {
  BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY,
  BATTLE_REPORT_OUTCOME_SUMMARY_CLASS,
  BATTLE_REPORT_ROW_SUMMARY_CLASS,
  MAIL_ATTACHMENT_SWEEP_CLASS,
  MAIL_TAB_EMPTY_HINT_CLASS,
  MARCH_INFO_CARD_CLASS,
  MARCH_ROW_SELECTED_CLASS,
} from "@/engine/wave33IntelBattleMailBagDailyNarrowManifest";
import { WORLD_TILE_FOCUS_PULSE_CLASS, WORLD_TILE_INFO_SELECTOR } from "@/engine/wave32MainCityBuildHeroShopDailyWorldNarrowManifest";
import { BATTLE_REPORT_DETAIL_NAV_CLASS } from "@/engine/wave31MarchMailSocialNarrowManifest";

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-179 / CLIENT-187. */
export const WAVE35_WORLD_INTEL_BATTLE_REPORT_MAIL_DAILY_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-195: wave:35 世界·军情·战报·邮件·日常·背包·商城组合窄屏 manifest at 1280×720.
 * Soft-deps CLIENT-188～194 wire DOM into these selectors.
 */
export const CLIENT_195_NARROW_MANIFEST_CENTER_PANEL_IDS = [
  "world",
  "march",
  "military",
  "battle-report",
  "mail",
  "daily",
  "bag",
  "shop",
] as const;

export type Client195NarrowManifestCenterPanelId =
  (typeof CLIENT_195_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

/** CLIENT-188: minimap pick ↔ tile info card mutual highlight (extends CLIENT-170 `world-tile-info`). */
export const WORLD_TILE_INFO_CARD_CLASS = "world-tile-info-card";
export const WORLD_TILE_INFO_CARD_SELECTOR = `.${WORLD_TILE_INFO_CARD_CLASS}`;
export const MINIMAP_FOCUS_PULSE_CLASS = "minimap-focus-pulse";
export const MINIMAP_FOCUS_PULSE_SELECTOR = `.${MINIMAP_FOCUS_PULSE_CLASS}`;
export const MINIMAP_MARCH_END_HIGHLIGHT_CLASS = "minimap-march-end-highlight";
export const MINIMAP_MARCH_END_HIGHLIGHT_SELECTOR = `.${MINIMAP_MARCH_END_HIGHLIGHT_CLASS}`;

/** CLIENT-189: march intel selection ↔ military form target coords highlight. */
export const MARCH_FORM_COORD_SYNC_HIGHLIGHT_CLASS = "march-form-coord-sync-highlight";
export const MARCH_FORM_COORD_SYNC_HIGHLIGHT_SELECTOR = `.${MARCH_FORM_COORD_SYNC_HIGHLIGHT_CLASS}`;

/** CLIENT-190: battle-report detail outcome band + adjacent list focus ring. */
export const BATTLE_REPORT_OUTCOME_BAND_CLASS = "battle-report-outcome-band";
export const BATTLE_REPORT_OUTCOME_BAND_SELECTOR = `.${BATTLE_REPORT_OUTCOME_BAND_CLASS}`;
export const BATTLE_REPORT_ADJACENT_FOCUS_RING_CLASS = "battle-report-adjacent-focus-ring";
export const BATTLE_REPORT_ADJACENT_FOCUS_RING_SELECTOR = `.${BATTLE_REPORT_ADJACENT_FOCUS_RING_CLASS}`;

/** CLIENT-191: replay jump pulse on minimap + session handoff for intel/battle-report. */
export const BATTLE_REPORT_REPLAY_SESSION_KEY = "battle-report-replay-v1";
export const MINIMAP_BATTLE_REPLAY_PULSE_CLASS = "minimap-battle-replay-pulse";
export const MINIMAP_BATTLE_REPLAY_PULSE_SELECTOR = `.${MINIMAP_BATTLE_REPLAY_PULSE_CLASS}`;

/** CLIENT-192: per-tab empty hints (CLIENT-177) + single-mail claim inline pulse. */
export const MAIL_CLAIM_INLINE_PULSE_CLASS = "mail-claim-inline-pulse";
export const MAIL_CLAIM_INLINE_PULSE_SELECTOR = `.${MAIL_CLAIM_INLINE_PULSE_CLASS}`;

/** CLIENT-193: claimable sweep line above daily filters + post-claim progress pulse. */
export const DAILY_CLAIMABLE_SWEEP_LINE_ROLE = "daily-claimable-sweep-line";
export const DAILY_CLAIMABLE_SWEEP_LINE_SELECTOR = `[data-role="${DAILY_CLAIMABLE_SWEEP_LINE_ROLE}"]`;
export const DAILY_CLAIM_PROGRESS_PULSE_CLASS = "daily-claim-progress-pulse";
export const DAILY_CLAIM_PROGRESS_PULSE_SELECTOR = `.${DAILY_CLAIM_PROGRESS_PULSE_CLASS}`;
export const HUD_TODO_SWEEP_LINE_ROLE = "hud-todo-sweep-line";
export const HUD_TODO_SWEEP_LINE_SELECTOR = `[data-role="${HUD_TODO_SWEEP_LINE_ROLE}"]`;

/** CLIENT-194: bag row inline state + shop price vs wallet gap read-only line. */
export const BAG_ROW_INLINE_STATE_CLASS = "bag-row-inline-state";
export const BAG_ROW_INLINE_STATE_SELECTOR = `.${BAG_ROW_INLINE_STATE_CLASS}`;
export const BAG_USE_INLINE_PULSE_CLASS = "bag-use-inline-pulse";
export const BAG_USE_INLINE_PULSE_SELECTOR = `.${BAG_USE_INLINE_PULSE_CLASS}`;
export const SHOP_PRICE_WALLET_GAP_LINE_CLASS = "shop-price-wallet-gap-line";
export const SHOP_PRICE_WALLET_GAP_LINE_SELECTOR = `.${SHOP_PRICE_WALLET_GAP_LINE_CLASS}`;

export {
  BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY,
  BATTLE_REPORT_OUTCOME_SUMMARY_CLASS,
  BATTLE_REPORT_ROW_SUMMARY_CLASS,
  BATTLE_REPORT_DETAIL_NAV_CLASS,
  MAIL_ATTACHMENT_SWEEP_CLASS,
  MAIL_TAB_EMPTY_HINT_CLASS,
  MARCH_INFO_CARD_CLASS,
  MARCH_ROW_SELECTED_CLASS,
  WORLD_TILE_FOCUS_PULSE_CLASS,
  WORLD_TILE_INFO_SELECTOR,
};

export const CLIENT_195_PANEL_ASSET_BY_CENTER_ID: Record<
  Client195NarrowManifestCenterPanelId,
  string
> = {
  world: PANEL_ASSET_WORLD,
  march: PANEL_ASSET_MARCH,
  military: PANEL_ASSET_MILITARY,
  "battle-report": PANEL_ASSET_BATTLE_REPORT,
  mail: PANEL_ASSET_DEFAULT,
  daily: PANEL_ASSET_DAILY,
  bag: PANEL_ASSET_BAG,
  shop: PANEL_ASSET_SHOP,
};

export const CLIENT_195_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client195NarrowManifestCenterPanelId,
  string
> = {
  world: "world-scroll",
  march: "march-scroll",
  military: "military-scroll",
  "battle-report": "battle-report-scroll",
  mail: "mail-scroll",
  daily: "daily-scroll",
  bag: "bag-scroll",
  shop: "shop-scroll",
};

export function panelScrollClearsBottomToolbar(paddingBottomPx: number): boolean {
  return paddingBottomPx >= TOOLBAR_HEIGHT;
}

export function isWave35WorldIntelBattleReportMailDailyArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryClient195PanelRoot(
  doc: ParentNode,
  panelId: Client195NarrowManifestCenterPanelId,
): HTMLElement | null {
  if (doc instanceof HTMLElement && doc.dataset.centerPanel === panelId) {
    return doc;
  }
  if (panelId === "military") {
    return doc.querySelector<HTMLElement>(`.military-panel[data-center-panel="military"]`);
  }
  return doc.querySelector<HTMLElement>(`[data-center-panel="${panelId}"]`);
}

/** No-op skin hook; nine-slice wired in MainCityScene / panel components. */
export function mountClient195PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isWave35WorldIntelBattleReportMailDailyArtSkinOff(_root)) return;
}
