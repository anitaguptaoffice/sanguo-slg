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
import {
  CLIENT_283_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client283NarrowManifestCenterPanelId,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_LABEL_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPER_RING_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPER_SWEEP_CLASS,
  GUILD_DUTY_HEADER_RESIDUAL_DEEPER_LINE_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_CLASS,
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPER_SUBLINE_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPER_PULSE_CLASS,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPER_SUBLINE_CLASS,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPER_LINE_CLASS,
  RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPER_STAMP_CLASS,
} from "@/engine/wave46MainCityHeroDailySocialQueueNarrowManifest";
import {
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_LABEL_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_CLASS,
  GUILD_DUTY_HEADER_RESIDUAL_DEEP_LINE_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_CLASS,
  HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_CLASS,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEP_LINE_CLASS,
  RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_DEEP_STAMP_CLASS,
} from "@/engine/wave44MainCityHeroDailySocialQueueNarrowManifest";
import {
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_LABEL_CLASS,
  DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_SWEEP_CLASS,
  GUILD_DUTY_HEADER_RESIDUAL_LINE_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_LINE_CLASS,
  HERO_LIST_LOYALTY_RESIDUAL_SUBLINE_CLASS,
  HERO_PANEL_STATE_RESIDUAL_SWEEP_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_CLASS,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_SUBLINE_CLASS,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_LINE_CLASS,
  RANK_PIN_KEEP_RESIDUAL_RING_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_STAMP_CLASS,
} from "@/engine/wave42MainCityHeroDailySocialQueueNarrowManifest";
import { HERO_LIST_RETURN_HIGHLIGHT_CLASS } from "@/engine/wave36MainCityQueueHeroSocialHudNarrowManifest";
import {
  DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS,
  QUEST_CLAIM_PROGRESS_PULSE_CLASS,
} from "@/engine/wave40MainCityHeroBagDailyGuildNarrowManifest";
import { DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_CLASS } from "@/net/domesticQueueEtaSegment";
import { HERO_LIST_FILTER_SESSION_KEY } from "@/net/heroListFilter";

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-283 / CLIENT-291. */
export const WAVE48_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-299: wave:48 主城·将领·日常·社交·队列·HUD 深链组合窄屏 manifest 巩固再加深一层 at 1280×720.
 * Soft-deps CLIENT-292～298 wire DOM into these selectors (**非** wave:47 CLIENT-291 世界军情战报邮件商城排行 manifest 面板集).
 */
export const CLIENT_299_NARROW_MANIFEST_CENTER_PANEL_IDS = CLIENT_283_NARROW_MANIFEST_CENTER_PANEL_IDS;

export type Client299NarrowManifestCenterPanelId = Client283NarrowManifestCenterPanelId;

/** CLIENT-292: queue ETA segment residual deepest label + finish countdown fourth line. */
export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_LABEL_CLASS =
  "domestic-queue-eta-segment-residual-deepest-label";

export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_FINISH_CLASS =
  "domestic-queue-eta-segment-residual-deepest-finish";

/** CLIENT-292: complete-focus seven-slot residual deepest ring (3s). */
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_CLASS =
  "domestic-queue-complete-focus-residual-deepest-ring";

/** CLIENT-293: next-finish preview residual deepest summary line. */
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_LINE_CLASS =
  "queue-next-finish-preview-residual-deepest-line";

/** CLIENT-293: preview row → slot cross-link residual deepest ring. */
export const DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_RING_CLASS =
  "domestic-slot-preview-cross-link-residual-deepest-ring";

/** CLIENT-294: hero list loyalty + XP residual deepest subline. */
export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_SUBLINE_CLASS =
  "hero-list-row-loyalty-residual-deepest-subline";

export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_SUBLINE_ROLE =
  "hero-list-loyalty-residual-deepest-subline";

/** CLIENT-294: hero detail consumable stack residual deepest sweep. */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_CLASS =
  "hero-detail-consumable-stack-residual-deepest-sweep";

/** CLIENT-295: hero panel loading/empty/error residual deepest sweep. */
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_CLASS = "hero-panel-state-residual-deepest-sweep";

/** CLIENT-295: filter chip session alongside CLIENT-279 / CLIENT-263 keys. */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY =
  "hero-list-filter-chip-residual-deepest-v1";

/** CLIENT-296: rank manual refresh cooldown residual deepest stamp. */
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_STAMP_CLASS =
  "rank-refresh-cooldown-residual-deepest-stamp";

/** CLIENT-296: pin row keep highlight after refresh deepest ring. */
export const RANK_PIN_KEEP_RESIDUAL_DEEPEST_RING_CLASS = "rank-pin-keep-residual-deepest-ring";

/** CLIENT-297: guild duty group header residual deepest line. */
export const GUILD_DUTY_HEADER_RESIDUAL_DEEPEST_LINE_CLASS = "guild-duty-header-residual-deepest-line";

/** CLIENT-297: chat unread divider residual deepest sweep. */
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_SWEEP_CLASS =
  "guild-chat-unread-divider-residual-deepest-sweep";

/** CLIENT-298: daily chain + queue ETA HUD residual deepest subline (manifest selector). */
export const QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_SUBLINE_CLASS =
  "quest-chain-queue-hud-residual-deepest-subline";

/** CLIENT-298: DOM class aligned with daily-quest row renderers (parallel CLIENT-298 net). */
export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_SUBLINE_CLASS =
  "daily-quest-chain-queue-hud-residual-deepest-subline";

export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_SUBLINE_ROLE =
  "daily-quest-chain-queue-hud-residual-deepest-subline";

/** CLIENT-298: HUD todo toolbar deep-link residual deepest pulse. */
export const HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_PULSE_CLASS =
  "hud-todo-toolbar-deep-link-residual-deepest-pulse";

/** Wave:46 / wave:44 / wave:42 baselines that must not regress alongside wave:48 residual deepest hooks. */
export {
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_CLASS,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_LABEL_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_LABEL_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_LABEL_CLASS,
  DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPER_RING_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS,
  DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPER_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_SWEEP_CLASS,
  GUILD_DUTY_HEADER_RESIDUAL_DEEPER_LINE_CLASS,
  GUILD_DUTY_HEADER_RESIDUAL_DEEP_LINE_CLASS,
  GUILD_DUTY_HEADER_RESIDUAL_LINE_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_LINE_CLASS,
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPER_SESSION_KEY,
  HERO_LIST_FILTER_SESSION_KEY,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPER_SUBLINE_CLASS,
  HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_CLASS,
  HERO_LIST_LOYALTY_RESIDUAL_SUBLINE_CLASS,
  HERO_LIST_RETURN_HIGHLIGHT_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_SWEEP_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPER_PULSE_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_CLASS,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPER_SUBLINE_CLASS,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_CLASS,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_SUBLINE_CLASS,
  QUEST_CLAIM_PROGRESS_PULSE_CLASS,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPER_LINE_CLASS,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEP_LINE_CLASS,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_LINE_CLASS,
  RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS,
  RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS,
  RANK_PIN_KEEP_RESIDUAL_RING_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPER_STAMP_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_DEEP_STAMP_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_STAMP_CLASS,
};
export { DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_CLASS };

export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_LABEL_SELECTOR = `.content-panel[data-center-panel="queue"] .${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_LABEL_CLASS}`;
export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_FINISH_SELECTOR = `.content-panel[data-center-panel="queue"] .${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_FINISH_CLASS}`;
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_SELECTOR = `.main-city-slot-overlay .${DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_CLASS}, .main-city-slot-upgrade-tag .${DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_CLASS}, .content-panel[data-center-panel="queue"] .queue-list li.${DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_CLASS}`;
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_LINE_SELECTOR = `.content-panel[data-center-panel="queue"] .${QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_LINE_CLASS}`;
export const DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_RING_SELECTOR = `.main-city-slot-overlay .${DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_RING_CLASS}, .main-city-slot-upgrade-tag .${DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_RING_CLASS}, .content-panel[data-center-panel="queue"] .queue-list li.${DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_RING_CLASS}`;
export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_SUBLINE_SELECTOR = `.content-panel[data-center-panel="hero"] .hero-list li.${HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_SUBLINE_CLASS}, .content-panel[data-center-panel="hero"] .hero-list li [data-role="${HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_SUBLINE_ROLE}"]`;
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_SELECTOR = `.content-panel[data-center-panel="hero"] .${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_CLASS}`;
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_SELECTOR = `.content-panel[data-center-panel="hero"] .${HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_CLASS}`;
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_STAMP_SELECTOR = `.content-panel[data-center-panel="rank"] .${RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_STAMP_CLASS}`;
export const RANK_PIN_KEEP_RESIDUAL_DEEPEST_RING_SELECTOR = `.content-panel[data-center-panel="rank"] .rank-list li.${RANK_PIN_KEEP_RESIDUAL_DEEPEST_RING_CLASS}`;
export const GUILD_DUTY_HEADER_RESIDUAL_DEEPEST_LINE_SELECTOR = `.social-panel[data-center-panel="guild"] .${GUILD_DUTY_HEADER_RESIDUAL_DEEPEST_LINE_CLASS}`;
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_SWEEP_SELECTOR = `.social-panel[data-center-panel="chat"] .chat-log li.${GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_SWEEP_CLASS}`;
export const QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_SUBLINE_SELECTOR = `.content-panel[data-center-panel="daily"] .daily-quest-list .${QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_SUBLINE_CLASS}, .content-panel[data-center-panel="daily"] .daily-quest-list li .${DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_SUBLINE_CLASS}`;
export const HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_PULSE_SELECTOR = `#layout-frame.layout-narrow #hud .${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_PULSE_CLASS}, #layout-frame.layout-narrow .main-city-toolbar button.${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_PULSE_CLASS}`;

export const CLIENT_299_PANEL_ASSET_BY_CENTER_ID: Record<
  Client299NarrowManifestCenterPanelId,
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

export const CLIENT_299_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client299NarrowManifestCenterPanelId,
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

export function isWave48MainCityHeroDailySocialQueueArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryClient299PanelRoot(
  doc: ParentNode,
  panelId: Client299NarrowManifestCenterPanelId,
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

/** Safe no-op when CLIENT-292～298 sibling DOM is not mounted yet. */
export function pulseWave48ResidualNarrowHook(root: ParentNode, selector: string): void {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) return;
  el.classList.add("wave48-narrow-hook-pulse");
  window.setTimeout(() => el.classList.remove("wave48-narrow-hook-pulse"), 0);
}

/** No-op skin hook; nine-slice wired in MainCityScene / panel components. */
export function mountClient299PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isWave48MainCityHeroDailySocialQueueArtSkinOff(_root)) return;
}
