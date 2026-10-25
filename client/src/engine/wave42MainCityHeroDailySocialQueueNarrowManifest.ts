import type { AssetLoader } from "@/engine/AssetLoader";
import {
  PANEL_ASSET_CHAT,
  PANEL_ASSET_DAILY,
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_GUILD,
  PANEL_ASSET_HERO,
  PANEL_ASSET_QUEUE,
  PANEL_ASSET_RANK,
} from "@/engine/artPanelSkin";
import { TOOLBAR_HEIGHT } from "@/engine/mainCitySlots";
import { HERO_LIST_RETURN_HIGHLIGHT_CLASS } from "@/engine/wave36MainCityQueueHeroSocialHudNarrowManifest";
import {
  DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS,
  QUEST_CLAIM_PROGRESS_PULSE_CLASS,
} from "@/engine/wave40MainCityHeroBagDailyGuildNarrowManifest";
import { DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_CLASS } from "@/net/domesticQueueEtaSegment";
import { HERO_LIST_FILTER_SESSION_KEY } from "@/net/heroListFilter";

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-235 / CLIENT-243. */
export const WAVE42_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-251: wave:42 主城·将领·日常·社交·队列·HUD 深链组合窄屏 manifest at 1280×720.
 * Soft-deps CLIENT-244～250 wire DOM into these selectors (**非** wave:41 世界军情战报邮件商城栈).
 */
export const CLIENT_251_NARROW_MANIFEST_CENTER_PANEL_IDS = [
  "building",
  "queue",
  "hero",
  "rank",
  "guild",
  "chat",
  "daily",
] as const;

export type Client251NarrowManifestCenterPanelId =
  (typeof CLIENT_251_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

/** CLIENT-244: queue ETA segment residual subline beside CLIENT-212 label. */
export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_LABEL_CLASS =
  "domestic-queue-eta-segment-residual-label";

/** CLIENT-244: complete-state seven-slot focus residual ring. */
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_CLASS =
  "domestic-queue-complete-focus-residual-ring";

/** CLIENT-245: next-finish preview residual summary line (CLIENT-218 baseline). */
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_LINE_CLASS =
  "queue-next-finish-preview-residual-line";

/** CLIENT-245: slot complete margin residual ring on domestic overlay. */
export const DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_CLASS =
  "domestic-slot-complete-margin-residual-ring";

/** CLIENT-261 */
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEP_LINE_CLASS =
  "queue-next-finish-preview-residual-deep-line";
export const DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS =
  "domestic-slot-preview-cross-link-residual-deep-ring";
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS =
  "domestic-queue-complete-focus-residual-deep-ring";

/** CLIENT-246: hero list loyalty residual subline (CLIENT-213 baseline). */
export const HERO_LIST_LOYALTY_RESIDUAL_SUBLINE_CLASS = "hero-list-loyalty-residual-subline";

/** CLIENT-246: hero detail consumable stack residual scan line. */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_LINE_CLASS =
  "hero-detail-consumable-stack-residual-line";

/** CLIENT-262: hero list loyalty residual deep subline (CLIENT-246 baseline). */
export const HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_CLASS =
  "hero-list-row-loyalty-residual-deep-subline";

/** CLIENT-262: hero detail consumable stack residual deep sweep line. */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_CLASS =
  "hero-detail-consumable-stack-residual-deep-sweep";

/** CLIENT-247: hero panel loading/empty/error residual sweep row. */
export const HERO_PANEL_STATE_RESIDUAL_SWEEP_CLASS = "hero-panel-state-residual-sweep";

/** CLIENT-263: hero panel state consolidated deep sweep row (CLIENT-247 baseline). */
export const HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_CLASS =
  "hero-panel-state-residual-deep-sweep";

/** CLIENT-247: filter chip session key alongside CLIENT-231 `hero-list-filter-v1`. */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY = "hero-list-filter-chip-residual-v1";

/** CLIENT-263: filter chip deep session key alongside CLIENT-247 v1. */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY =
  "hero-list-filter-chip-residual-deep-v1";

/** CLIENT-263: filter chip deep sweep line under filter bar. */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SWEEP_CLASS =
  "hero-list-filter-chip-residual-deep-sweep";

/** CLIENT-279: hero panel state consolidated deeper sweep row (CLIENT-263 baseline). */
export const HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_CLASS =
  "hero-panel-state-residual-deeper-sweep";

/** CLIENT-279: filter chip deeper session key alongside CLIENT-263 deep v1. */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY =
  "hero-list-filter-chip-residual-deeper-v1";

/** CLIENT-279: filter chip deeper sweep line under filter bar. */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SWEEP_CLASS =
  "hero-list-filter-chip-residual-deeper-sweep";

/** CLIENT-295: hero panel state consolidated deepest sweep row (CLIENT-279 baseline). */
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_CLASS =
  "hero-panel-state-residual-deepest-sweep";

/** CLIENT-295: filter chip deepest session key alongside CLIENT-279 deeper v1. */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY =
  "hero-list-filter-chip-residual-deepest-v1";

/** CLIENT-295: filter chip deepest sweep line under filter bar. */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SWEEP_CLASS =
  "hero-list-filter-chip-residual-deepest-sweep";

/** CLIENT-248: rank manual refresh cooldown residual stamp line. */
export const RANK_REFRESH_COOLDOWN_RESIDUAL_STAMP_CLASS = "rank-refresh-cooldown-residual-stamp";

/** CLIENT-248: pin row keep highlight after manual refresh. */
export const RANK_PIN_KEEP_RESIDUAL_RING_CLASS = "rank-pin-keep-residual-ring";

/** CLIENT-264: consolidated cooldown deep stamp + pin deep ring (CLIENT-248/214 no regress). */
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEP_STAMP_CLASS =
  "rank-refresh-cooldown-residual-deep-stamp";
export const RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS = "rank-pin-keep-residual-deep-ring";
/** CLIENT-280: rank cooldown deeper stamp + pin deeper ring (CLIENT-264/248 no regress). */
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPER_STAMP_CLASS =
  "rank-refresh-cooldown-residual-deeper-stamp";
export const RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS = "rank-pin-keep-residual-deeper-ring";
export const RANK_MANUAL_REFRESH_COUNT_SESSION_KEY = "rank-manual-refresh-count";

/** CLIENT-249: guild duty group header residual line. */
export const GUILD_DUTY_HEADER_RESIDUAL_LINE_CLASS = "guild-duty-header-residual-line";

/** CLIENT-249: chat unread divider residual sweep ring. */
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_SWEEP_CLASS =
  "guild-chat-unread-divider-residual-sweep";

/** CLIENT-265: guild duty header consolidated deep subline. */
export const GUILD_DUTY_HEADER_RESIDUAL_DEEP_LINE_CLASS = "guild-duty-header-residual-deep-line";

/** CLIENT-265: chat unread divider residual deep sweep. */
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_CLASS =
  "guild-chat-unread-divider-residual-deep-sweep";

/** CLIENT-250: daily chain + queue ETA HUD residual subline. */
export const QUEST_CHAIN_QUEUE_HUD_RESIDUAL_SUBLINE_CLASS = "quest-chain-queue-hud-residual-subline";

/** CLIENT-250: HUD todo toolbar deep-link residual pulse. */
export const HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_CLASS =
  "hud-todo-toolbar-deep-link-residual-pulse";

/** CLIENT-266: daily chain + queue ETA HUD residual deep subline. */
export const QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_CLASS =
  "quest-chain-queue-hud-residual-deep-subline";

/** CLIENT-266: HUD todo toolbar deep-link residual deep pulse (2s). */
export const HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS =
  "hud-todo-toolbar-deep-link-residual-deep-pulse";

/** Wave:40 / wave:38 baselines that must not regress alongside wave:42 residuals. */
export {
  DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS,
  HERO_LIST_FILTER_SESSION_KEY,
  HERO_LIST_RETURN_HIGHLIGHT_CLASS,
  QUEST_CLAIM_PROGRESS_PULSE_CLASS,
};
export { DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_CLASS };

export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_LABEL_SELECTOR = `.content-panel[data-center-panel="queue"] .${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_LABEL_CLASS}`;
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_SELECTOR = `.main-city-slot-overlay .${DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_CLASS}, .main-city-slot-upgrade-tag .${DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_CLASS}, .content-panel[data-center-panel="queue"] .queue-list li.${DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_CLASS}`;
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_LINE_SELECTOR = `.content-panel[data-center-panel="queue"] .${QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_LINE_CLASS}`;
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEP_LINE_SELECTOR = `.content-panel[data-center-panel="queue"] .${QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEP_LINE_CLASS}`;
export const DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_SELECTOR = `.main-city-slot-overlay .${DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_CLASS}, .main-city-slot-upgrade-tag .${DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_CLASS}`;
export const DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_SELECTOR = `.main-city-slot-overlay .${DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS}, .main-city-slot-upgrade-tag .${DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS}`;
export const HERO_LIST_LOYALTY_RESIDUAL_SUBLINE_SELECTOR = `.content-panel[data-center-panel="hero"] .hero-list .${HERO_LIST_LOYALTY_RESIDUAL_SUBLINE_CLASS}`;
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_LINE_SELECTOR = `.content-panel[data-center-panel="hero"] .${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_LINE_CLASS}`;
export const HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_SELECTOR = `.content-panel[data-center-panel="hero"] .hero-list .${HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_CLASS}`;
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_SELECTOR = `.content-panel[data-center-panel="hero"] .${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_CLASS}`;
export const HERO_PANEL_STATE_RESIDUAL_SWEEP_SELECTOR = `.content-panel[data-center-panel="hero"] .${HERO_PANEL_STATE_RESIDUAL_SWEEP_CLASS}`;
export const HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_SELECTOR = `.content-panel[data-center-panel="hero"] .${HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_CLASS}`;
export const HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_SELECTOR = `.content-panel[data-center-panel="hero"] .${HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_CLASS}`;
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SWEEP_SELECTOR = `.content-panel[data-center-panel="hero"] .${HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SWEEP_CLASS}`;
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SWEEP_SELECTOR = `.content-panel[data-center-panel="hero"] .${HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SWEEP_CLASS}`;
export const RANK_REFRESH_COOLDOWN_RESIDUAL_STAMP_SELECTOR = `.content-panel[data-center-panel="rank"] .${RANK_REFRESH_COOLDOWN_RESIDUAL_STAMP_CLASS}`;
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEP_STAMP_SELECTOR = `.content-panel[data-center-panel="rank"] .${RANK_REFRESH_COOLDOWN_RESIDUAL_DEEP_STAMP_CLASS}`;
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPER_STAMP_SELECTOR = `.content-panel[data-center-panel="rank"] .${RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPER_STAMP_CLASS}`;
export const RANK_PIN_KEEP_RESIDUAL_RING_SELECTOR = `.content-panel[data-center-panel="rank"] .rank-list li.${RANK_PIN_KEEP_RESIDUAL_RING_CLASS}`;
export const RANK_PIN_KEEP_RESIDUAL_DEEP_RING_SELECTOR = `.content-panel[data-center-panel="rank"] .rank-table tr.rank-pin-row.${RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS}`;
export const RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_SELECTOR = `.content-panel[data-center-panel="rank"] .rank-table tr.rank-pin-row.${RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS}`;
export const GUILD_DUTY_HEADER_RESIDUAL_LINE_SELECTOR = `.social-panel[data-center-panel="guild"] .${GUILD_DUTY_HEADER_RESIDUAL_LINE_CLASS}`;
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_SWEEP_SELECTOR = `.social-panel[data-center-panel="chat"] .chat-log li.${GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_SWEEP_CLASS}`;
export const QUEST_CHAIN_QUEUE_HUD_RESIDUAL_SUBLINE_SELECTOR = `.content-panel[data-center-panel="daily"] .daily-quest-list .${QUEST_CHAIN_QUEUE_HUD_RESIDUAL_SUBLINE_CLASS}`;
export const QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_SELECTOR = `.content-panel[data-center-panel="daily"] .daily-quest-list .${QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_CLASS}`;
export const HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_SELECTOR = `#layout-frame.layout-narrow #hud .${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_CLASS}, #layout-frame.layout-narrow .main-city-toolbar button.${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_CLASS}`;
export const HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_SELECTOR = `#layout-frame.layout-narrow #hud .${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS}, #layout-frame.layout-narrow .main-city-toolbar button.${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS}`;

export const CLIENT_251_PANEL_ASSET_BY_CENTER_ID: Record<
  Client251NarrowManifestCenterPanelId,
  string
> = {
  building: PANEL_ASSET_DEFAULT,
  queue: PANEL_ASSET_QUEUE,
  hero: PANEL_ASSET_HERO,
  rank: PANEL_ASSET_RANK,
  guild: PANEL_ASSET_GUILD,
  chat: PANEL_ASSET_CHAT,
  daily: PANEL_ASSET_DAILY,
};

export const CLIENT_251_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client251NarrowManifestCenterPanelId,
  string
> = {
  building: "building-scroll",
  queue: "queue-scroll",
  hero: "hero-scroll",
  rank: "rank-scroll",
  guild: "guild-scroll",
  chat: "chat-scroll",
  daily: "daily-scroll",
};

export function panelScrollClearsBottomToolbar(paddingBottomPx: number): boolean {
  return paddingBottomPx >= TOOLBAR_HEIGHT;
}

export function isWave42MainCityHeroDailySocialQueueArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryClient251PanelRoot(
  doc: ParentNode,
  panelId: Client251NarrowManifestCenterPanelId,
): HTMLElement | null {
  if (doc instanceof HTMLElement && doc.dataset.centerPanel === panelId) {
    return doc;
  }
  if (panelId === "building") {
    return doc.querySelector<HTMLElement>(`.building-panel[data-center-panel="building"]`);
  }
  if (panelId === "guild" || panelId === "chat") {
    return doc.querySelector<HTMLElement>(`.social-panel[data-center-panel="${panelId}"]`);
  }
  return doc.querySelector<HTMLElement>(`[data-center-panel="${panelId}"]`);
}

/** No-op skin hook; nine-slice wired in MainCityScene / panel components. */
export function mountClient251PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isWave42MainCityHeroDailySocialQueueArtSkinOff(_root)) return;
}
