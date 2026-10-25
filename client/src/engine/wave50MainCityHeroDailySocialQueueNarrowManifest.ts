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
  CLIENT_299_NARROW_MANIFEST_CENTER_PANEL_IDS,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_CLASS,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_LABEL_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_LABEL_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_RING_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPER_RING_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPER_SWEEP_CLASS,
  GUILD_DUTY_HEADER_RESIDUAL_DEEPEST_LINE_CLASS,
  GUILD_DUTY_HEADER_RESIDUAL_DEEPER_LINE_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_CLASS,
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_SUBLINE_CLASS,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPER_SUBLINE_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_PULSE_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPER_PULSE_CLASS,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_SUBLINE_CLASS,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPER_SUBLINE_CLASS,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_LINE_CLASS,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPER_LINE_CLASS,
  RANK_PIN_KEEP_RESIDUAL_DEEPEST_RING_CLASS,
  RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_STAMP_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPER_STAMP_CLASS,
  type Client299NarrowManifestCenterPanelId,
} from "@/engine/wave48MainCityHeroDailySocialQueueNarrowManifest";

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-299 / CLIENT-307. */
export const WAVE50_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-315: wave:50 主城·将领·日常·社交·队列·HUD 深链组合窄屏 manifest 巩固再加深二层 at 1280×720.
 * Soft-deps CLIENT-308～314 wire DOM into these selectors (**非** wave:49 CLIENT-307 世界军情战报邮件商城排行 manifest 面板集).
 */
export const CLIENT_315_NARROW_MANIFEST_CENTER_PANEL_IDS = CLIENT_299_NARROW_MANIFEST_CENTER_PANEL_IDS;

export type Client315NarrowManifestCenterPanelId = Client299NarrowManifestCenterPanelId;

/** CLIENT-308: queue ETA segment residual deepest-deeper label + finish countdown fifth line. */
export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPER_LABEL_CLASS =
  "domestic-queue-eta-segment-residual-deepest-deeper-label";

export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPER_FINISH_CLASS =
  "domestic-queue-eta-segment-residual-deepest-deeper-finish";

/** CLIENT-308: complete-focus seven-slot residual deepest-deeper ring (3.5s). */
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPER_RING_CLASS =
  "domestic-queue-complete-focus-residual-deepest-deeper-ring";

/** CLIENT-309: next-finish preview residual deepest-deeper summary line. */
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS =
  "queue-next-finish-preview-residual-deepest-deeper-line";

/** CLIENT-309: preview row → slot cross-link residual deepest-deeper ring. */
export const DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPER_RING_CLASS =
  "domestic-slot-preview-cross-link-residual-deepest-deeper-ring";

/** CLIENT-325: next-finish preview residual deepest-deepest-deeper summary line. */
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_CLASS =
  "queue-next-finish-preview-residual-deepest-deepest-deeper-line";

/** CLIENT-325: preview row → slot cross-link residual deepest-deepest-deeper ring. */
export const DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS =
  "domestic-slot-preview-cross-link-residual-deepest-deepest-deeper-ring";

/** CLIENT-324 stub / CLIENT-325: complete-focus seven-slot residual deepest-deepest-deeper ring (3.5s). */
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS =
  "domestic-queue-complete-focus-residual-deepest-deepest-deeper-ring";

/** CLIENT-310: hero list loyalty + XP residual deepest-deeper subline. */
export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPER_SUBLINE_CLASS =
  "hero-list-row-loyalty-residual-deepest-deeper-subline";

export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPER_SUBLINE_ROLE =
  "hero-list-loyalty-residual-deepest-deeper-subline";

/** CLIENT-310: hero detail consumable stack residual deepest-deeper sweep. */
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS =
  "hero-detail-consumable-stack-residual-deepest-deeper-sweep";

/** CLIENT-311: hero panel loading/empty/error residual deepest-deeper sweep. */
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS =
  "hero-panel-state-residual-deepest-deeper-sweep";

/** CLIENT-311: filter chip session alongside CLIENT-295 / CLIENT-279 keys. */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_DEEPER_SESSION_KEY =
  "hero-list-filter-chip-residual-deepest-deeper-v1";

/** CLIENT-312: rank manual refresh cooldown residual deepest-deeper stamp. */
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_DEEPER_STAMP_CLASS =
  "rank-refresh-cooldown-residual-deepest-deeper-stamp";

/** CLIENT-312: pin row keep highlight after refresh deepest-deeper ring. */
export const RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPER_RING_CLASS =
  "rank-pin-keep-residual-deepest-deeper-ring";

/** CLIENT-328: rank manual refresh cooldown residual deepest-deepest-deeper stamp. */
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_STAMP_CLASS =
  "rank-refresh-cooldown-residual-deepest-deepest-deeper-stamp";

/** CLIENT-328: pin row keep highlight after refresh deepest-deepest-deeper ring. */
export const RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS =
  "rank-pin-keep-residual-deepest-deepest-deeper-ring";

/** CLIENT-313: guild duty group header residual deepest-deeper line. */
export const GUILD_DUTY_HEADER_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS =
  "guild-duty-header-residual-deepest-deeper-line";

/** CLIENT-313: chat unread divider residual deepest-deeper sweep. */
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS =
  "guild-chat-unread-divider-residual-deepest-deeper-sweep";

/** CLIENT-314: daily chain + queue ETA HUD residual deepest-deeper subline (manifest selector). */
export const QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPER_SUBLINE_CLASS =
  "quest-chain-queue-hud-residual-deepest-deeper-subline";

/** CLIENT-314: DOM class aligned with daily-quest row renderers (parallel CLIENT-314 net). */
export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPER_SUBLINE_CLASS =
  "daily-quest-chain-queue-hud-residual-deepest-deeper-subline";

export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPER_SUBLINE_ROLE =
  "daily-quest-chain-queue-hud-residual-deepest-deeper-subline";

/** CLIENT-314: HUD todo toolbar deep-link residual deepest-deeper pulse. */
export const HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS =
  "hud-todo-toolbar-deep-link-residual-deepest-deeper-pulse";

/** CLIENT-330: daily chain + queue ETA HUD residual deepest-deepest-deeper subline (manifest selector). */
export const QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS =
  "quest-chain-queue-hud-residual-deepest-deepest-deeper-subline";

/** CLIENT-330: DOM class aligned with daily-quest row renderers (parallel CLIENT-330 net). */
export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS =
  "daily-quest-chain-queue-hud-residual-deepest-deepest-deeper-subline";

export const DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_ROLE =
  "daily-quest-chain-queue-hud-residual-deepest-deepest-deeper-subline";

/** CLIENT-330: HUD todo toolbar deep-link residual deepest-deepest-deeper pulse. */
export const HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS =
  "hud-todo-toolbar-deep-link-residual-deepest-deepest-deeper-pulse";

/** Wave:48 baselines that must not regress alongside wave:50 residual deepest-deeper hooks. */
export {
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_RING_CLASS,
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPER_RING_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_LABEL_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPER_LABEL_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_RING_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPER_RING_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_SWEEP_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPER_SWEEP_CLASS,
  GUILD_DUTY_HEADER_RESIDUAL_DEEPEST_LINE_CLASS,
  GUILD_DUTY_HEADER_RESIDUAL_DEEPER_LINE_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_SWEEP_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPER_SWEEP_CLASS,
  HERO_LIST_FILTER_CHIP_RESIDUAL_DEEPEST_SESSION_KEY,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_SUBLINE_CLASS,
  HERO_LIST_LOYALTY_RESIDUAL_DEEPER_SUBLINE_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPEST_SWEEP_CLASS,
  HERO_PANEL_STATE_RESIDUAL_DEEPER_SWEEP_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_PULSE_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPER_PULSE_CLASS,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_SUBLINE_CLASS,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPER_SUBLINE_CLASS,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_LINE_CLASS,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPER_LINE_CLASS,
  RANK_PIN_KEEP_RESIDUAL_DEEPEST_RING_CLASS,
  RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_STAMP_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPER_STAMP_CLASS,
};

export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPER_LABEL_SELECTOR = `.content-panel[data-center-panel="queue"] .${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPER_LABEL_CLASS}`;
export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPER_FINISH_SELECTOR = `.content-panel[data-center-panel="queue"] .${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEPEST_DEEPER_FINISH_CLASS}`;
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPER_RING_SELECTOR = `.main-city-slot-overlay .${DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPER_RING_CLASS}, .main-city-slot-upgrade-tag .${DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPER_RING_CLASS}, .content-panel[data-center-panel="queue"] .queue-list li.${DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEPEST_DEEPER_RING_CLASS}`;
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_DEEPER_LINE_SELECTOR = `.content-panel[data-center-panel="queue"] .${QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS}`;
export const DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPER_RING_SELECTOR = `.main-city-slot-overlay .${DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPER_RING_CLASS}, .main-city-slot-upgrade-tag .${DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPER_RING_CLASS}, .content-panel[data-center-panel="queue"] .queue-list li.${DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEPEST_DEEPER_RING_CLASS}`;
export const HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPER_SUBLINE_SELECTOR = `.content-panel[data-center-panel="hero"] .hero-list li.${HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPER_SUBLINE_CLASS}, .content-panel[data-center-panel="hero"] .hero-list li [data-role="${HERO_LIST_LOYALTY_RESIDUAL_DEEPEST_DEEPER_SUBLINE_ROLE}"]`;
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPER_SWEEP_SELECTOR = `.content-panel[data-center-panel="hero"] .${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS}`;
export const HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_SELECTOR = `.content-panel[data-center-panel="hero"] .${HERO_PANEL_STATE_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS}`;
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_DEEPER_STAMP_SELECTOR = `.content-panel[data-center-panel="rank"] .${RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_DEEPER_STAMP_CLASS}`;
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_STAMP_SELECTOR = `.content-panel[data-center-panel="rank"] .${RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_STAMP_CLASS}`;
export const RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPER_RING_SELECTOR = `.content-panel[data-center-panel="rank"] .rank-list li.${RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPER_RING_CLASS}`;
export const RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_SELECTOR = `.content-panel[data-center-panel="rank"] .rank-list li.${RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS}, .content-panel[data-center-panel="rank"] .rank-table tr.rank-pin-row.${RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS}`;
export const GUILD_DUTY_HEADER_RESIDUAL_DEEPEST_DEEPER_LINE_SELECTOR = `.social-panel[data-center-panel="guild"] .${GUILD_DUTY_HEADER_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS}`;
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPER_SWEEP_SELECTOR = `.social-panel[data-center-panel="chat"] .chat-log li.${GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEPEST_DEEPER_SWEEP_CLASS}`;
export const QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPER_SUBLINE_SELECTOR = `.content-panel[data-center-panel="daily"] .daily-quest-list .${QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPER_SUBLINE_CLASS}, .content-panel[data-center-panel="daily"] .daily-quest-list li .${DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPER_SUBLINE_CLASS}`;
export const QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_SELECTOR = `.content-panel[data-center-panel="daily"] .daily-quest-list .${QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS}, .content-panel[data-center-panel="daily"] .daily-quest-list li .${DAILY_QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS}`;
export const HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPER_PULSE_SELECTOR = `#layout-frame.layout-narrow #hud .${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS}, #layout-frame.layout-narrow .main-city-toolbar button.${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS}`;
export const HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_SELECTOR = `#layout-frame.layout-narrow #hud .${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS}, #layout-frame.layout-narrow .main-city-toolbar button.${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS}`;

export const CLIENT_315_PANEL_ASSET_BY_CENTER_ID: Record<
  Client315NarrowManifestCenterPanelId,
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

export const CLIENT_315_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client315NarrowManifestCenterPanelId,
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

export function isWave50MainCityHeroDailySocialQueueArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryClient315PanelRoot(
  doc: ParentNode,
  panelId: Client315NarrowManifestCenterPanelId,
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

/** Safe no-op when CLIENT-308～314 sibling DOM is not mounted yet. */
export function pulseWave50ResidualNarrowHook(root: ParentNode, selector: string): void {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) return;
  el.classList.add("wave50-narrow-hook-pulse");
  window.setTimeout(() => el.classList.remove("wave50-narrow-hook-pulse"), 0);
}

/** No-op skin hook; nine-slice wired in MainCityScene / panel components. */
export function mountClient315PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isWave50MainCityHeroDailySocialQueueArtSkinOff(_root)) return;
}
