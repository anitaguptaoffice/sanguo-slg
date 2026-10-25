import type { AssetLoader } from "@/engine/AssetLoader";
import {
  CLIENT_347_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_347_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_347_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LABEL_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS,
  GUILD_DUTY_HEADER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS,
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_CLASS,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_ROLE,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_CLASS,
  DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_CLASS,
  DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_ROLE,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS,
  RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_STAMP_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_STAMP_ROLE,
  isWave54MainCityHeroDailySocialQueueArtSkinOff,
  mountClient347PanelSkins,
  pulseWave54ResidualNarrowHook,
  queryClient347PanelRoot,
  type Client347NarrowManifestCenterPanelId,
} from "@/engine/wave54MainCityHeroDailySocialQueueNarrowManifest";
import { TOOLBAR_HEIGHT } from "@/engine/mainCitySlots";

import { panelScrollClearsBottomToolbar } from "@/engine/wave54MainCityHeroDailySocialQueueNarrowManifest";

export { panelScrollClearsBottomToolbar };

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-347 / CLIENT-331. */
export const WAVE56_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-363: wave:56 主城·将领·日常·社交·队列·HUD 深链组合窄屏 manifest 巩固再加深五层 at 1280×720.
 * Soft-deps CLIENT-356～362 wire DOM into these selectors (**非** wave:55 CLIENT-355 世界栈面板集).
 */
export const CLIENT_363_NARROW_MANIFEST_CENTER_PANEL_IDS = CLIENT_347_NARROW_MANIFEST_CENTER_PANEL_IDS;

export type Client363NarrowManifestCenterPanelId = Client347NarrowManifestCenterPanelId;

/** CLIENT-356: queue ETA segment residual deepest-deepest-deepest-deepest label + finish countdown eighth line. */
export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_LABEL_CLASS =
  "domestic-queue-eta-segment-residual-deepest-deepest-deepest-deepest-label";

export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_FINISH_CLASS =
  "domestic-queue-eta-segment-residual-deepest-deepest-deepest-deepest-finish";

/** CLIENT-356: complete-focus seven-slot residual deepest-deepest-deepest-deepest ring (3.5s). */
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_RING_CLASS =
  "domestic-queue-complete-focus-residual-deepest-deepest-deepest-deepest-ring";

/** CLIENT-357: next-finish preview residual deepest-deepest-deepest-deepest summary line. */
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS =
  "queue-next-finish-preview-residual-deepest-deepest-deepest-deepest-line";

/** CLIENT-357: preview row → slot cross-link residual deepest-deepest-deepest-deepest ring. */
export const DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_RING_CLASS =
  "domestic-slot-preview-cross-link-residual-deepest-deepest-deepest-deepest-ring";

export const DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_ACTION =
  "domestic-slot-preview-cross-link-residual-deepest-deepest-deepest-deepest-ring";

/** CLIENT-358: hero list loyalty + XP residual deepest-deepest-deepest-deepest subline. */
export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SUBLINE_CLASS =
  "hero-list-row-loyalty-residual-deepest-deepest-deepest-deepest-subline";

export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SUBLINE_ROLE =
  "hero-list-loyalty-residual-deepest-deepest-deepest-deepest-subline";

/** CLIENT-358: hero detail consumable stack residual deepest-deepest-deepest-deepest sweep. */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS =
  "hero-detail-consumable-stack-residual-deepest-deepest-deepest-deepest-sweep";

/** CLIENT-359: hero panel loading/empty/error residual deepest-deepest-deepest-deepest sweep. */
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS =
  "hero-panel-state-residual-deepest-deepest-deepest-deepest-sweep";

/** CLIENT-359: filter chip session alongside CLIENT-343 / CLIENT-327 keys. */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY =
  "hero-list-filter-chip-residual-deepest-deepest-deepest-deepest-v1";

/** CLIENT-359 (main tip): hero panel residual deepest-deepest-deepest-deeper — preserved with CLIENT-363 deepen-5. */
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS =
  "hero-panel-state-residual-deepest-deepest-deepest-deeper-sweep";

/** CLIENT-359 (main tip): filter chip session deepest-deepest-deepest-deeper. */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SESSION_KEY =
  "hero-list-filter-chip-residual-deepest-deepest-deepest-deeper-v1";

/** CLIENT-360: rank manual refresh cooldown residual deepest-deepest-deepest-deepest stamp. */
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_STAMP_CLASS =
  "rank-refresh-cooldown-residual-deepest-deepest-deepest-deepest-stamp";

export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_STAMP_ROLE =
  "rank-refresh-cooldown-residual-deepest-deepest-deepest-deepest";

/** CLIENT-360: pin row keep highlight after refresh deepest-deepest-deepest-deepest ring. */
export const RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_RING_CLASS =
  "rank-pin-keep-residual-deepest-deepest-deepest-deepest-ring";

/** CLIENT-361: guild duty group header residual deepest-deepest-deepest-deepest line. */
export const GUILD_DUTY_HEADER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS =
  "guild-duty-header-residual-deepest-deepest-deepest-deepest-line";

/** CLIENT-361: chat unread divider residual deepest-deepest-deepest-deepest sweep. */
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS =
  "guild-chat-unread-divider-residual-deepest-deepest-deepest-deepest-sweep";

/** CLIENT-362: daily chain + queue ETA HUD residual deepest-deepest-deepest-deepest subline (manifest selector). */
export const QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SUBLINE_CLASS =
  "quest-chain-queue-hud-residual-deepest-deepest-deepest-deepest-subline";

/** CLIENT-362: DOM class aligned with daily-quest row renderers (parallel CLIENT-362 net). */
export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SUBLINE_CLASS =
  "daily-quest-chain-queue-hud-residual-deepest-deepest-deepest-deepest-subline";

export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SUBLINE_ROLE =
  "daily-quest-chain-queue-hud-residual-deepest-deepest-deepest-deepest-subline";

/** CLIENT-362: HUD todo toolbar deep-link residual deepest-deepest-deepest-deepest pulse. */
export const HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS =
  "hud-todo-toolbar-deep-link-residual-deepest-deepest-deepest-deepest-pulse";

/** Wave:54 baselines that must not regress alongside wave:56 residual deepest-deepest-deepest-deepest hooks. */
export {
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LABEL_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS,
  GUILD_DUTY_HEADER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS,
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SESSION_KEY,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_CLASS,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_ROLE,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_CLASS,
  DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_CLASS,
  DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_ROLE,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS,
  RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_STAMP_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_STAMP_ROLE,
};

export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_LABEL_SELECTOR = `.content-panel[data-center-panel="queue"] .${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_LABEL_CLASS}`;
export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_FINISH_SELECTOR = `.content-panel[data-center-panel="queue"] .${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_FINISH_CLASS}`;
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_RING_SELECTOR = `.main-city-slot-overlay .${DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_RING_CLASS}, .main-city-slot-upgrade-tag .${DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_RING_CLASS}, .content-panel[data-center-panel="queue"] .queue-list li.${DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_RING_CLASS}`;
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_LINE_SELECTOR = `.content-panel[data-center-panel="queue"] .${QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS}`;
export const DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_RING_SELECTOR = `.main-city-slot-overlay .${DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_RING_CLASS}, .main-city-slot-upgrade-tag .${DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_RING_CLASS}, .content-panel[data-center-panel="queue"] .queue-list li.${DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_RING_CLASS}, .content-panel[data-center-panel="queue"] [data-action="${DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_ACTION}"]`;
export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SUBLINE_SELECTOR = `.content-panel[data-center-panel="hero"] .hero-list li.${HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SUBLINE_CLASS}, .content-panel[data-center-panel="hero"] .hero-list li [data-role="${HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SUBLINE_ROLE}"]`;
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_SELECTOR = `.content-panel[data-center-panel="hero"] .${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS}`;
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_SELECTOR = `.content-panel[data-center-panel="hero"] .${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS}`;
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_SELECTOR = `.content-panel[data-center-panel="hero"] .${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS}`;
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_STAMP_SELECTOR = `.content-panel[data-center-panel="rank"] .${RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_STAMP_CLASS}, .content-panel[data-center-panel="rank"] [data-role="${RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_STAMP_ROLE}"]`;
export const RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_RING_SELECTOR = `.content-panel[data-center-panel="rank"] .rank-list li.${RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_RING_CLASS}`;
export const GUILD_DUTY_HEADER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_LINE_SELECTOR = `.social-panel[data-center-panel="guild"] .${GUILD_DUTY_HEADER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS}`;
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_SELECTOR = `.social-panel[data-center-panel="chat"] .chat-log li.${GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS}`;
export const QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SUBLINE_SELECTOR = `.content-panel[data-center-panel="daily"] .daily-quest-list .${QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SUBLINE_CLASS}, .content-panel[data-center-panel="daily"] .daily-quest-list li .${DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_SUBLINE_CLASS}`;
export const HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_PULSE_SELECTOR = `#layout-frame.layout-narrow #hud .${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS}, #layout-frame.layout-narrow .main-city-toolbar button.${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS}`;

export const CLIENT_363_PANEL_ASSET_BY_CENTER_ID = CLIENT_347_PANEL_ASSET_BY_CENTER_ID;

export const CLIENT_363_PANEL_SCROLL_ROLE_BY_CENTER_ID = CLIENT_347_PANEL_SCROLL_ROLE_BY_CENTER_ID;

export function wave56PanelScrollClearsBottomToolbar(paddingBottomPx: number): boolean {
  return panelScrollClearsBottomToolbar(paddingBottomPx) && paddingBottomPx >= TOOLBAR_HEIGHT;
}

export function isWave56MainCityHeroDailySocialQueueArtSkinOff(el: HTMLElement): boolean {
  return isWave54MainCityHeroDailySocialQueueArtSkinOff(el);
}

export function queryClient363PanelRoot(
  doc: ParentNode,
  panelId: Client363NarrowManifestCenterPanelId,
): HTMLElement | null {
  return queryClient347PanelRoot(doc, panelId);
}

/** Safe no-op when CLIENT-356～362 sibling DOM is not mounted yet. */
export function pulseWave56ResidualNarrowHook(root: ParentNode, selector: string): void {
  pulseWave54ResidualNarrowHook(root, selector);
}

/** No-op skin hook; nine-slice wired in MainCityScene / panel components. */
export function mountClient363PanelSkins(root: HTMLElement, assets: AssetLoader): void {
  mountClient347PanelSkins(root, assets);
}
