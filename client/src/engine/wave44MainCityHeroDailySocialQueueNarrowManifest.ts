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
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_LABEL_CLASS,
  DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_SWEEP_CLASS,
  GUILD_DUTY_HEADER_RESIDUAL_LINE_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_LINE_CLASS,
  HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY,
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
import {
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEP_LINE_CLASS,
} from "@/engine/wave42MainCityHeroDailySocialQueueNarrowManifest";
import {
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_LABEL_CLASS,
} from "@/net/domesticQueueEtaSegmentResidualDeep";
import { HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_CLASS } from "@/net/heroDetailConsumableStackResidualDeepSweep";
import { HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_CLASS } from "@/net/heroListLoyaltyResidualDeepSubline";

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-251 / CLIENT-259. */
export const WAVE44_MAIN_CITY_HERO_DAILY_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-267: wave:44 主城·将领·日常·社交·队列·HUD 深链组合窄屏 manifest 巩固 at 1280×720.
 * Soft-deps CLIENT-260～266 wire DOM into these selectors (**非** wave:43 CLIENT-259 世界军情战报邮件商城排行 manifest 面板集).
 */
export const CLIENT_267_NARROW_MANIFEST_CENTER_PANEL_IDS = [
  "building",
  "queue",
  "hero",
  "rank",
  "guild",
  "chat",
  "daily",
] as const;

export type Client267NarrowManifestCenterPanelId =
  (typeof CLIENT_267_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

export {
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_FINISH_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_LABEL_CLASS,
  DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_CLASS,
  HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_CLASS,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEP_LINE_CLASS,
};

/** CLIENT-263: hero panel loading/empty/error residual deep sweep. */
export const HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_CLASS = "hero-panel-state-residual-deep-sweep";

/** CLIENT-263: filter chip session alongside CLIENT-231 / CLIENT-247 keys. */
export const HERO_LIST_FILTER_CHIP_RESIDUAL_DEEP_SESSION_KEY = "hero-list-filter-chip-residual-deep-v1";

/** CLIENT-264: rank manual refresh cooldown residual deep stamp. */
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEP_STAMP_CLASS =
  "rank-refresh-cooldown-residual-deep-stamp";

/** CLIENT-264: pin row keep highlight after refresh deep ring. */
export const RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS = "rank-pin-keep-residual-deep-ring";

/** CLIENT-280: rank cooldown deeper stamp + pin deeper ring. */
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPER_STAMP_CLASS =
  "rank-refresh-cooldown-residual-deeper-stamp";
export const RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS = "rank-pin-keep-residual-deeper-ring";

/** CLIENT-265: guild duty group header residual deep line. */
export const GUILD_DUTY_HEADER_RESIDUAL_DEEP_LINE_CLASS = "guild-duty-header-residual-deep-line";

/** CLIENT-265: chat unread divider residual deep sweep. */
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_CLASS =
  "guild-chat-unread-divider-residual-deep-sweep";

/** CLIENT-266: daily chain + queue ETA HUD residual deep subline. */
export const QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_CLASS =
  "quest-chain-queue-hud-residual-deep-subline";

/** CLIENT-266: HUD todo toolbar deep-link residual deep pulse. */
export const HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS =
  "hud-todo-toolbar-deep-link-residual-deep-pulse";

/** Wave:42 / wave:40 baselines that must not regress alongside wave:44 deep residuals. */
export {
  DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_RING_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_LABEL_CLASS,
  DOMESTIC_SLOT_COMPLETE_MARGIN_RESIDUAL_RING_CLASS,
  DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS,
  GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_SWEEP_CLASS,
  GUILD_DUTY_HEADER_RESIDUAL_LINE_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_LINE_CLASS,
  HERO_LIST_FILTER_CHIP_RESIDUAL_SESSION_KEY,
  HERO_LIST_FILTER_SESSION_KEY,
  HERO_LIST_LOYALTY_RESIDUAL_SUBLINE_CLASS,
  HERO_LIST_RETURN_HIGHLIGHT_CLASS,
  HERO_PANEL_STATE_RESIDUAL_SWEEP_CLASS,
  HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_CLASS,
  QUEST_CHAIN_QUEUE_HUD_RESIDUAL_SUBLINE_CLASS,
  QUEST_CLAIM_PROGRESS_PULSE_CLASS,
  QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_LINE_CLASS,
  RANK_PIN_KEEP_RESIDUAL_RING_CLASS,
  RANK_REFRESH_COOLDOWN_RESIDUAL_STAMP_CLASS,
};
export { DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_CLASS };

export const DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_LABEL_SELECTOR = `.content-panel[data-center-panel="queue"] .${DOMESTIC_QUEUE_ETA_SEGMENT_RESIDUAL_DEEP_LABEL_CLASS}`;
export const DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_SELECTOR = `.main-city-slot-overlay .${DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS}, .main-city-slot-upgrade-tag .${DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS}, .content-panel[data-center-panel="queue"] .queue-list li.${DOMESTIC_QUEUE_COMPLETE_FOCUS_RESIDUAL_DEEP_RING_CLASS}`;
export const QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEP_LINE_SELECTOR = `.content-panel[data-center-panel="queue"] .${QUEUE_NEXT_FINISH_PREVIEW_RESIDUAL_DEEP_LINE_CLASS}`;
export const DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_SELECTOR = `.main-city-slot-overlay .${DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS}, .main-city-slot-upgrade-tag .${DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS}, .content-panel[data-center-panel="queue"] .queue-list li.${DOMESTIC_SLOT_PREVIEW_CROSS_LINK_RESIDUAL_DEEP_RING_CLASS}`;
export const HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_SELECTOR = `.content-panel[data-center-panel="hero"] .hero-list li.${HERO_LIST_LOYALTY_RESIDUAL_DEEP_SUBLINE_CLASS}`;
export const HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_SELECTOR = `.content-panel[data-center-panel="hero"] .${HERO_DETAIL_CONSUMABLE_STACK_RESIDUAL_DEEP_SWEEP_CLASS}`;
export const HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_SELECTOR = `.content-panel[data-center-panel="hero"] .${HERO_PANEL_STATE_RESIDUAL_DEEP_SWEEP_CLASS}`;
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEP_STAMP_SELECTOR = `.content-panel[data-center-panel="rank"] .${RANK_REFRESH_COOLDOWN_RESIDUAL_DEEP_STAMP_CLASS}`;
export const RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPER_STAMP_SELECTOR = `.content-panel[data-center-panel="rank"] .${RANK_REFRESH_COOLDOWN_RESIDUAL_DEEPER_STAMP_CLASS}`;
export const RANK_PIN_KEEP_RESIDUAL_DEEP_RING_SELECTOR = `.content-panel[data-center-panel="rank"] .rank-list li.${RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS}`;
export const RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_SELECTOR = `.content-panel[data-center-panel="rank"] .rank-table tr.rank-pin-row.${RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS}`;
export const GUILD_DUTY_HEADER_RESIDUAL_DEEP_LINE_SELECTOR = `.social-panel[data-center-panel="guild"] .${GUILD_DUTY_HEADER_RESIDUAL_DEEP_LINE_CLASS}`;
export const GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_SELECTOR = `.social-panel[data-center-panel="chat"] .chat-log li.${GUILD_CHAT_UNREAD_DIVIDER_RESIDUAL_DEEP_SWEEP_CLASS}`;
export const QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_SELECTOR = `.content-panel[data-center-panel="daily"] .daily-quest-list .${QUEST_CHAIN_QUEUE_HUD_RESIDUAL_DEEP_SUBLINE_CLASS}`;
export const HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_SELECTOR = `#layout-frame.layout-narrow #hud .${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS}, #layout-frame.layout-narrow .main-city-toolbar button.${HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS}`;

export const CLIENT_267_PANEL_ASSET_BY_CENTER_ID: Record<
  Client267NarrowManifestCenterPanelId,
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

export const CLIENT_267_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client267NarrowManifestCenterPanelId,
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

export function isWave44MainCityHeroDailySocialQueueArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryClient267PanelRoot(
  doc: ParentNode,
  panelId: Client267NarrowManifestCenterPanelId,
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

/** Safe no-op when CLIENT-260～266 sibling DOM is not mounted yet. */
export function pulseWave44ResidualNarrowHook(root: ParentNode, selector: string): void {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) return;
  el.classList.add("wave44-narrow-hook-pulse");
  window.setTimeout(() => el.classList.remove("wave44-narrow-hook-pulse"), 0);
}

/** No-op skin hook; nine-slice wired in MainCityScene / panel components. */
export function mountClient267PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isWave44MainCityHeroDailySocialQueueArtSkinOff(_root)) return;
}
