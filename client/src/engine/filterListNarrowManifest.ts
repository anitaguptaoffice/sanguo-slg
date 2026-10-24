import type { AssetLoader } from "@/engine/AssetLoader";
import { mountFilterUiSkins } from "@/engine/artUiFilterSkin";
import {
  PANEL_ASSET_BATTLE_REPORT,
  PANEL_ASSET_DAILY,
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_MARCH,
} from "@/engine/artPanelSkin";
import { PANEL_FILTER_CHIP_BAR_CLASS } from "@/engine/panelFilterChipBarClass";

/** Bottom toolbar height (layout-landscape) + focus-ring slack for scroll padding. */
export const FILTER_LIST_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/** CLIENT-127: center panels with ART-UI-FILTER-008 filter bars + scrollable list bodies at 1280×720. */
export const CLIENT_127_NARROW_FILTER_LIST_CENTER_PANEL_IDS = [
  "mail",
  "daily",
  "march",
  "battle-report",
] as const;

export type Client127NarrowFilterListCenterPanelId =
  (typeof CLIENT_127_NARROW_FILTER_LIST_CENTER_PANEL_IDS)[number];

/** Panel root nine-slice ids (CLIENT-086 / CLIENT-103 / mail default). */
export const CLIENT_127_PANEL_ASSET_BY_CENTER_ID: Record<
  Client127NarrowFilterListCenterPanelId,
  string
> = {
  mail: PANEL_ASSET_DEFAULT,
  daily: PANEL_ASSET_DAILY,
  march: PANEL_ASSET_MARCH,
  "battle-report": PANEL_ASSET_BATTLE_REPORT,
};

/** Scroll region `data-role` on each panel (nested in `.panel-scroll-body`). */
export const CLIENT_127_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client127NarrowFilterListCenterPanelId,
  string
> = {
  mail: "mail-scroll",
  daily: "daily-scroll",
  march: "march-scroll",
  "battle-report": "battle-report-scroll",
};

/**
 * Filter chip / phase bar roots inside each panel.
 * Soft-deps CLIENT-122～125: may add `data-ui-filter-chip` inside these bars.
 */
export { PANEL_FILTER_CHIP_BAR_CLASS } from "@/engine/panelFilterChipBarClass";

/** CLIENT-155 / soft-dep CLIENT-150: chain progress secondary line on daily quest rows. */
export const DAILY_QUEST_PROGRESS_SECONDARY_CLASS = "daily-quest-row-progress";

/** CLIENT-163 / soft-dep CLIENT-159: mail inbox batch toolbar hosts claim-all beside filter chips. */
export const MAIL_CLAIM_ALL_ATTACHMENTS_ACTION = "claim-mail-all";

export const CLIENT_127_FILTER_CHIP_BAR_SELECTOR_BY_CENTER_ID: Record<
  Client127NarrowFilterListCenterPanelId,
  string
> = {
  mail: `.mail-inbox-toolbar.${PANEL_FILTER_CHIP_BAR_CLASS}`,
  daily: `.daily-quest-filters.${PANEL_FILTER_CHIP_BAR_CLASS}`,
  march: `.march-list-filter.${PANEL_FILTER_CHIP_BAR_CLASS}`,
  "battle-report": `.battle-report-filters.${PANEL_FILTER_CHIP_BAR_CLASS}`,
};

export function isFilterListArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryFilterListPanelRoot(
  doc: ParentNode,
  panelId: Client127NarrowFilterListCenterPanelId,
): HTMLElement | null {
  if (doc instanceof HTMLElement && doc.dataset.centerPanel === panelId) {
    return doc;
  }
  return doc.querySelector<HTMLElement>(`[data-center-panel="${panelId}"]`);
}

export function queryFilterChipBar(
  panelRoot: HTMLElement,
  panelId: Client127NarrowFilterListCenterPanelId,
): HTMLElement | null {
  const sel = CLIENT_127_FILTER_CHIP_BAR_SELECTOR_BY_CENTER_ID[panelId];
  return panelRoot.querySelector<HTMLElement>(sel);
}

/** Wire ART-UI-FILTER-008 mounts when panels opt in via data attributes (no-op until CLIENT-122～126). */
export function mountFilterListPanelSkins(root: HTMLElement, assets: AssetLoader): void {
  if (isFilterListArtSkinOff(root)) return;
  mountFilterUiSkins(root, assets);
}

/** CLIENT-169 / CLIENT-171: multi chain_id tab bar above daily quest filters at 1280×720. */
export {
  DAILY_CHAIN_TAB_BAR_CLASS,
  DAILY_CHAIN_TAB_CLASS,
  DAILY_CHAIN_TAB_SESSION_KEY,
} from "@/engine/wave32MainCityBuildHeroShopDailyWorldNarrowManifest";

/** CLIENT-187: wave:34 主城将领排行社交 HUD 组合窄屏钩子（180～185 见 main 实装）。 */
export {
  CITY_SLOT_PULSE_CLASS,
  DAILY_QUEUE_ANCHOR_HIGHLIGHT_CLASS,
  GUILD_ROLE_GROUP_HEADER_CLASS,
  HERO_LIST_SELECTED_SESSION_KEY,
  LEADERBOARD_TOP_DENSITY_LINE_CLASS,
} from "@/engine/wave34MainCityHeroRankSocialHudNarrowManifest";

/** CLIENT-195: wave:35 世界军情战报邮件日常背包商城组合窄屏钩子（188～194 见 main 实装）。 */
export {
  BAG_ROW_INLINE_STATE_CLASS,
  BATTLE_REPORT_ADJACENT_FOCUS_RING_CLASS,
  BATTLE_REPORT_OUTCOME_BAND_CLASS,
  BATTLE_REPORT_REPLAY_SESSION_KEY,
  DAILY_CLAIM_PROGRESS_PULSE_CLASS,
  MAIL_CLAIM_INLINE_PULSE_CLASS,
  MARCH_FORM_COORD_SYNC_HIGHLIGHT_CLASS,
  MINIMAP_FOCUS_PULSE_CLASS,
  MINIMAP_MARCH_END_HIGHLIGHT_CLASS,
  SHOP_PRICE_WALLET_GAP_LINE_CLASS,
  WORLD_TILE_INFO_CARD_CLASS,
} from "@/engine/wave35WorldIntelBattleReportMailDailyNarrowManifest";

/** CLIENT-204: wave:37 小地图多行军终点叠标（软依赖 CLIENT-188）。 */
export {
  MINIMAP_MARCH_STACK_BADGE_CLASS,
  WORLD_TILE_MARCH_SUMMARY_LINE_CLASS,
} from "@/engine/wave37MinimapMarchStackNarrowManifest";

/** CLIENT-203: wave:36 主城队列将领社交 HUD 深链组合窄屏钩子（196～202 见 main 实装）。 */
export {
  CENTER_PANEL_TAB_PULSE_CLASS,
  GUILD_CHAT_EMPTY_ERROR_ROW_CLASS,
  GUILD_CHAT_RETRY_INLINE_CLASS,
  HERO_GROWTH_COMPARE_STRIP_CLASS,
  HERO_LIST_RETURN_HIGHLIGHT_CLASS,
  HERO_LIST_RETURN_SESSION_KEY,
  HERO_UPGRADE_PROGRESS_BAR_CLASS,
  HUD_CENTER_PANEL_DEEPLINK_LINE_ROLE,
  QUEUE_ROW_COMPLETE_PULSE_CLASS,
  QUEUE_ROW_ETA_LINE_CLASS,
  QUEUE_ROW_PROGRESS_BAR_CLASS,
  RECRUIT_FORM_INLINE_HINT_CLASS,
} from "@/engine/wave36MainCityQueueHeroSocialHudNarrowManifest";

/** CLIENT-211: wave:37 世界军情战报邮件背包组合窄屏钩子（204～210 见 main 实装）。 */
export {
  BAG_CATEGORY_SCROLL_SESSION_KEY,
  BAG_ROW_RETURN_HIGHLIGHT_CLASS,
  BATTLE_REPORT_LIST_STREAK_LINE_CLASS,
  BATTLE_REPORT_ROUND_SUMMARY_STRIP_CLASS,
  BATTLE_REPORT_TIME_FILTER_SESSION_KEY,
  INTEL_ROW_PHASE_SUBLINE_CLASS,
  MAIL_TAB_HUD_SYNC_PULSE_CLASS,
  MAIL_TAB_UNREAD_SWEEP_LINE_CLASS,
  MARCH_FORM_RESERVE_WARN_CLASS,
  MARCH_FORM_TROOP_RESERVE_LINE_CLASS,
  MARCH_INTEL_PHASE_ETA_STRIP_CLASS,
} from "@/engine/wave37WorldIntelBattleReportMailBagNarrowManifest";

/** CLIENT-219: wave:38 主城将领社交队列 HUD 深链组合窄屏钩子（212～218 见 main 实装）。 */
export {
  DAILY_QUEST_CHAIN_TYPE_SUBLINE_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_CLASS,
  DOMESTIC_QUEUE_COMPLETE_SLOT_MARGIN_CLASS,
  GUILD_CHAT_BACKOFF_RETRY_CLASS,
  GUILD_MEMBER_ONLINE_SUMMARY_CLASS,
  GUILD_MEMBER_ONLINE_SUMMARY_ROLE,
  HERO_DETAIL_CONSUMABLE_STACK_LINE_CLASS,
  HERO_LIST_LOYALTY_SUBLINE_CLASS,
  HERO_LOYALTY_WARN_DOT_CLASS,
  HUD_TODO_MERGED_SWEEP_CLASS,
  HUD_TODO_MERGED_SWEEP_LINE_ROLE,
  QUEUE_NEXT_FINISH_PREVIEW_ACTION,
  QUEUE_NEXT_FINISH_PREVIEW_CLASS,
  RANK_EMPTY_RETRY_INLINE_CLASS,
  RANK_MANUAL_REFRESH_SESSION_KEY,
  RANK_REFRESH_COOLDOWN_STAMP_CLASS,
  RANK_REFRESH_COOLDOWN_STAMP_ROLE,
  RECRUIT_WALLET_COMPARE_LINE_CLASS,
  RECRUIT_WALLET_COMPARE_LINE_ROLE,
  SHOP_WALLET_COMPARE_LINE_CLASS,
  SHOP_WALLET_COMPARE_LINE_ROLE,
  TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS,
} from "@/engine/wave38MainCityHeroSocialQueueNarrowManifest";

/** CLIENT-220: wave:39 小地图格点 ↔ 军情列表双向同步高亮环。 */
export {
  INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_CLASS,
  MINIMAP_INTEL_SYNC_RING_CLASS,
} from "@/engine/wave39MinimapIntelSyncNarrowManifest";
