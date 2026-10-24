import type { AssetLoader } from "@/engine/AssetLoader";
import {
  PANEL_ASSET_BAG,
  PANEL_ASSET_BATTLE_REPORT,
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_MARCH,
  PANEL_ASSET_MILITARY,
  PANEL_ASSET_SHOP,
  PANEL_ASSET_WORLD,
} from "@/engine/artPanelSkin";
import { TOOLBAR_HEIGHT } from "@/engine/mainCitySlots";
import { BAG_CATEGORY_TAB_SESSION_KEY } from "@/net/bagCategory";
import {
  BATTLE_REPORT_OUTCOME_BAND_CLASS,
  MARCH_FORM_COORD_SYNC_HIGHLIGHT_CLASS,
  MINIMAP_MARCH_END_HIGHLIGHT_CLASS,
} from "@/engine/wave35WorldIntelBattleReportMailDailyNarrowManifest";
import {
  BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY,
  BATTLE_REPORT_OUTCOME_SUMMARY_CLASS,
  BATTLE_REPORT_ROW_SUMMARY_CLASS,
  MARCH_INFO_CARD_CLASS,
  MARCH_ROW_SELECTED_CLASS,
} from "@/engine/wave33IntelBattleMailBagDailyNarrowManifest";
import { HUD_CENTER_PANEL_DEEPLINK_LINE_ROLE } from "@/net/hudCenterPanelDeepLink";

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-195 / CLIENT-203. */
export const WAVE37_WORLD_INTEL_BATTLE_REPORT_MAIL_BAG_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-211: wave:37 世界·军情·战报·邮件·背包组合窄屏 manifest at 1280×720.
 * Soft-deps CLIENT-204～210 wire DOM into these selectors.
 */
export const CLIENT_211_NARROW_MANIFEST_CENTER_PANEL_IDS = [
  "world",
  "march",
  "military",
  "battle-report",
  "mail",
  "bag",
  "shop",
] as const;

export type Client211NarrowManifestCenterPanelId =
  (typeof CLIENT_211_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

/** CLIENT-204: stacked march count on minimap + tile info card march summary subline. */
export const MINIMAP_MARCH_STACK_BADGE_CLASS = "minimap-march-stack-badge";
export const MINIMAP_MARCH_STACK_BADGE_SELECTOR = `.${MINIMAP_MARCH_STACK_BADGE_CLASS}`;
export const WORLD_TILE_MARCH_SUMMARY_LINE_CLASS = "world-tile-march-summary-line";
export const WORLD_TILE_MARCH_SUMMARY_LINE_SELECTOR = `.${WORLD_TILE_MARCH_SUMMARY_LINE_CLASS}`;

/** CLIENT-205: intel card phase/ETA strip + list row phase subline (sync highlight with CLIENT-172). */
export const MARCH_INTEL_PHASE_ETA_STRIP_CLASS = "march-intel-phase-eta-strip";
export const MARCH_INTEL_PHASE_ETA_STRIP_SELECTOR = `.${MARCH_INTEL_PHASE_ETA_STRIP_CLASS}`;
export const INTEL_ROW_PHASE_SUBLINE_CLASS = "intel-row-phase-subline";
export const INTEL_ROW_PHASE_SUBLINE_SELECTOR = `.${INTEL_ROW_PHASE_SUBLINE_CLASS}`;

/** CLIENT-206: troop reserve read-only line + inline warn when over city garrison. */
export const MARCH_FORM_TROOP_RESERVE_LINE_CLASS = "march-form-troop-reserve-line";
export const MARCH_FORM_TROOP_RESERVE_LINE_SELECTOR = `.${MARCH_FORM_TROOP_RESERVE_LINE_CLASS}`;
export const MARCH_FORM_RESERVE_WARN_CLASS = "march-form-reserve-warn";
export const MARCH_FORM_RESERVE_WARN_SELECTOR = `.${MARCH_FORM_RESERVE_WARN_CLASS}`;

/** CLIENT-207: time-window filter chips + list streak subline (CLIENT-176 outcome filter retained). */
export const BATTLE_REPORT_TIME_FILTER_SESSION_KEY = "battle-report-time-filter-v1";
export const BATTLE_REPORT_LIST_STREAK_LINE_CLASS = "battle-report-list-streak-line";
export const BATTLE_REPORT_LIST_STREAK_LINE_SELECTOR = `.${BATTLE_REPORT_LIST_STREAK_LINE_CLASS}`;

/** CLIENT-208: round summary strip under outcome band (CLIENT-190). */
export const BATTLE_REPORT_ROUND_SUMMARY_STRIP_CLASS = "battle-report-round-summary-strip";
export const BATTLE_REPORT_ROUND_SUMMARY_STRIP_SELECTOR = `.${BATTLE_REPORT_ROUND_SUMMARY_STRIP_CLASS}`;

/** CLIENT-209: per-tab unread sweep + HUD refresh sync pulse (CLIENT-202 deeplink line). */
export const MAIL_TAB_UNREAD_SWEEP_LINE_CLASS = "mail-tab-unread-sweep-line";
export const MAIL_TAB_UNREAD_SWEEP_LINE_SELECTOR = `.${MAIL_TAB_UNREAD_SWEEP_LINE_CLASS}`;
export const MAIL_TAB_HUD_SYNC_PULSE_CLASS = "mail-tab-hud-sync-pulse";
export const MAIL_TAB_HUD_SYNC_PULSE_SELECTOR = `.${MAIL_TAB_HUD_SYNC_PULSE_CLASS}`;
export const QUEST_CLAIM_HUD_LINK_LINE_ROLE = "quest-claim-hud-link-line";
export const QUEST_CLAIM_HUD_LINK_LINE_SELECTOR = `[data-role="${QUEST_CLAIM_HUD_LINK_LINE_ROLE}"]`;

/** CLIENT-210: bag category tab scroll memory + shop return row highlight. */
export { BAG_CATEGORY_TAB_SESSION_KEY };
export const BAG_CATEGORY_SCROLL_SESSION_KEY = "bag-category-scroll-v1";
export const BAG_ROW_RETURN_HIGHLIGHT_CLASS = "bag-row-return-highlight";
export const BAG_ROW_RETURN_HIGHLIGHT_SELECTOR = `.bag-list li.${BAG_ROW_RETURN_HIGHLIGHT_CLASS}`;

export {
  BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY,
  BATTLE_REPORT_OUTCOME_SUMMARY_CLASS,
  BATTLE_REPORT_OUTCOME_BAND_CLASS,
  BATTLE_REPORT_ROW_SUMMARY_CLASS,
  MARCH_FORM_COORD_SYNC_HIGHLIGHT_CLASS,
  MARCH_INFO_CARD_CLASS,
  MARCH_ROW_SELECTED_CLASS,
  MINIMAP_MARCH_END_HIGHLIGHT_CLASS,
  HUD_CENTER_PANEL_DEEPLINK_LINE_ROLE,
};

export const MARCH_INFO_CARD_SELECTOR = `.${MARCH_INFO_CARD_CLASS}`;
export const MARCH_ROW_SELECTED_SELECTOR = `.march-list li.${MARCH_ROW_SELECTED_CLASS}`;

export const CLIENT_211_PANEL_ASSET_BY_CENTER_ID: Record<
  Client211NarrowManifestCenterPanelId,
  string
> = {
  world: PANEL_ASSET_WORLD,
  march: PANEL_ASSET_MARCH,
  military: PANEL_ASSET_MILITARY,
  "battle-report": PANEL_ASSET_BATTLE_REPORT,
  mail: PANEL_ASSET_DEFAULT,
  bag: PANEL_ASSET_BAG,
  shop: PANEL_ASSET_SHOP,
};

export const CLIENT_211_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client211NarrowManifestCenterPanelId,
  string
> = {
  world: "world-scroll",
  march: "march-scroll",
  military: "military-scroll",
  "battle-report": "battle-report-scroll",
  mail: "mail-scroll",
  bag: "bag-scroll",
  shop: "shop-scroll",
};

export function panelScrollClearsBottomToolbar(paddingBottomPx: number): boolean {
  return paddingBottomPx >= TOOLBAR_HEIGHT;
}

export function isWave37WorldIntelBattleReportMailBagArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryClient211PanelRoot(
  doc: ParentNode,
  panelId: Client211NarrowManifestCenterPanelId,
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
export function mountClient211PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isWave37WorldIntelBattleReportMailBagArtSkinOff(_root)) return;
}
