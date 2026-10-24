import type { AssetLoader } from "@/engine/AssetLoader";
import {
  PANEL_ASSET_CHAT,
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_GUILD,
  PANEL_ASSET_HERO,
  PANEL_ASSET_QUEUE,
} from "@/engine/artPanelSkin";
import { TOOLBAR_HEIGHT } from "@/engine/mainCitySlots";
import { GUILD_CHAT_BACKOFF_RETRY_CLASS } from "@/net/guildChatGatewayBackoff";
import { GUILD_CHAT_RETRY_INLINE_CLASS } from "@/net/panelGatewayError";
import { formatGuildPanelEmptyHint, GUILD_MEMBER_ONLINE_SUMMARY_CLASS } from "@/net/socialFormat";

/** CLIENT-200 军团/聊天 empty·error 行 DOM（manifest 登记；实装见 SocialPanels）。 */
export const GUILD_PANEL_EMPTY_HINT_CLASS = "guild-panel-empty-hint";
export const GUILD_CHAT_EMPTY_ERROR_ROW_CLASS = "guild-chat-empty-error-row";
import {
  formatHeroGrowthCompareStrip,
  formatHeroUpgradeProgressLine,
  HERO_GROWTH_COMPARE_STRIP_CLASS,
  HERO_UPGRADE_PROGRESS_BAR_CLASS,
} from "@/net/heroGrowthCompareStrip";
import {
  formatHeroDetailFromListHint,
  HERO_LIST_RETURN_SESSION_KEY,
  parseHeroListReturnState,
  serializeHeroListReturnState,
} from "@/net/heroListReturnState";

/** CLIENT-199 列表返回行高亮（`HeroMailPanels` DOM；manifest 登记）。 */
export const HERO_LIST_RETURN_HIGHLIGHT_CLASS = "hero-list-return-highlight";
import {
  CENTER_PANEL_TAB_PULSE_CLASS,
  formatHudCenterPanelDeepLinkLine,
  HUD_CENTER_PANEL_DEEPLINK_LINE_ROLE,
  resolveCenterPanelTabFromHudTodo,
} from "@/net/hudCenterPanelDeepLink";
import {
  formatHudTodoMergedSweepLine,
  HUD_TODO_MERGED_SWEEP_LINE_ROLE,
  resolveToolbarPanelFromHudTodo,
  TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS,
} from "@/net/hudTodoMergedSweep";
import { CITY_SLOT_PULSE_CLASS, QUEUE_ROW_SLOT_HIGHLIGHT_CLASS } from "@/net/citySlotQueueLink";
import {
  CITY_SLOT_COMPLETE_FOCUS_RING_CLASS,
  QUEUE_ROW_COMPLETE_PULSE_CLASS,
  shouldRingCitySlotOnQueueComplete,
} from "@/net/queueCompleteFocusRing";
import {
  formatQueueRemainingEtaLine,
  QUEUE_ROW_ETA_LINE_CLASS,
  QUEUE_ROW_PROGRESS_BAR_CLASS,
} from "@/net/queueRemainingEtaLine";
import {
  BAG_HERO_ITEM_GAP_HIGHLIGHT_CLASS,
  formatRecruitFormInlineHint,
  RECRUIT_FORM_INLINE_HINT_ROLE,
  RECRUIT_FORM_INLINE_WARN_CLASS,
} from "@/net/recruitFormInlineHint";

/** 与 DOM class / `data-role` 同名（CLIENT-201）。 */
export const RECRUIT_FORM_INLINE_HINT_CLASS = RECRUIT_FORM_INLINE_HINT_ROLE;

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-187 / CLIENT-195. */
export const WAVE36_MAIN_CITY_QUEUE_HERO_SOCIAL_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-203: wave:36 主城队列·将领养成·社交·HUD 深链组合窄屏 manifest at 1280×720.
 * Soft-deps CLIENT-196～202 wire DOM into these selectors.
 */
export const CLIENT_203_NARROW_MANIFEST_CENTER_PANEL_IDS = [
  "building",
  "queue",
  "hero",
  "guild",
  "chat",
] as const;

export type Client203NarrowManifestCenterPanelId =
  (typeof CLIENT_203_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

export {
  formatQueueRemainingEtaLine,
  QUEUE_ROW_ETA_LINE_CLASS,
  QUEUE_ROW_PROGRESS_BAR_CLASS,
  shouldRingCitySlotOnQueueComplete,
  CITY_SLOT_COMPLETE_FOCUS_RING_CLASS,
  QUEUE_ROW_COMPLETE_PULSE_CLASS,
  formatHeroGrowthCompareStrip,
  formatHeroUpgradeProgressLine,
  HERO_GROWTH_COMPARE_STRIP_CLASS,
  HERO_UPGRADE_PROGRESS_BAR_CLASS,
  serializeHeroListReturnState,
  parseHeroListReturnState,
  formatHeroDetailFromListHint,
  HERO_LIST_RETURN_SESSION_KEY,
  formatGuildPanelEmptyHint,
  GUILD_MEMBER_ONLINE_SUMMARY_CLASS,
  GUILD_CHAT_RETRY_INLINE_CLASS,
  GUILD_CHAT_BACKOFF_RETRY_CLASS,
  formatRecruitFormInlineHint,
  RECRUIT_FORM_INLINE_WARN_CLASS,
  BAG_HERO_ITEM_GAP_HIGHLIGHT_CLASS,
  formatHudCenterPanelDeepLinkLine,
  formatHudTodoMergedSweepLine,
  resolveCenterPanelTabFromHudTodo,
  resolveToolbarPanelFromHudTodo,
  HUD_CENTER_PANEL_DEEPLINK_LINE_ROLE,
  HUD_TODO_MERGED_SWEEP_LINE_ROLE,
  CENTER_PANEL_TAB_PULSE_CLASS,
  TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS,
  CITY_SLOT_PULSE_CLASS,
  QUEUE_ROW_SLOT_HIGHLIGHT_CLASS,
};

export const QUEUE_ROW_ETA_LINE_SELECTOR = `.queue-list li .${QUEUE_ROW_ETA_LINE_CLASS}`;
export const QUEUE_ROW_PROGRESS_BAR_SELECTOR = `.queue-list li .${QUEUE_ROW_PROGRESS_BAR_CLASS}`;
export const CITY_SLOT_COMPLETE_FOCUS_RING_SELECTOR = `.main-city-slot-upgrade-tag.${CITY_SLOT_COMPLETE_FOCUS_RING_CLASS}`;
export const QUEUE_ROW_COMPLETE_PULSE_SELECTOR = `.queue-list li.${QUEUE_ROW_COMPLETE_PULSE_CLASS}`;
export const HERO_GROWTH_COMPARE_STRIP_SELECTOR = `.${HERO_GROWTH_COMPARE_STRIP_CLASS}`;
export const HERO_UPGRADE_PROGRESS_BAR_SELECTOR = `.${HERO_UPGRADE_PROGRESS_BAR_CLASS}`;
export const HERO_LIST_RETURN_HIGHLIGHT_SELECTOR = `.hero-list li.${HERO_LIST_RETURN_HIGHLIGHT_CLASS}`;
export const GUILD_PANEL_EMPTY_HINT_SELECTOR = `.${GUILD_PANEL_EMPTY_HINT_CLASS}`;
export const GUILD_CHAT_EMPTY_ERROR_ROW_SELECTOR = `.${GUILD_CHAT_EMPTY_ERROR_ROW_CLASS}`;
export const GUILD_CHAT_RETRY_INLINE_SELECTOR = `.${GUILD_CHAT_RETRY_INLINE_CLASS}`;
export const GUILD_CHAT_BACKOFF_RETRY_SELECTOR = `.${GUILD_CHAT_BACKOFF_RETRY_CLASS}`;
export const GUILD_MEMBER_ONLINE_SUMMARY_SELECTOR = `.${GUILD_MEMBER_ONLINE_SUMMARY_CLASS}`;
export const RECRUIT_FORM_INLINE_HINT_SELECTOR = `[data-role="${RECRUIT_FORM_INLINE_HINT_ROLE}"], .recruit-form-inline-hint`;
export const HUD_CENTER_PANEL_DEEPLINK_LINE_SELECTOR = `[data-role="${HUD_CENTER_PANEL_DEEPLINK_LINE_ROLE}"]`;
export const HUD_TODO_MERGED_SWEEP_LINE_SELECTOR = `#hud .hud-todo-merged-sweep, [data-role="${HUD_TODO_MERGED_SWEEP_LINE_ROLE}"]`;
export const CENTER_PANEL_TAB_PULSE_SELECTOR = `.main-city-toolbar .${CENTER_PANEL_TAB_PULSE_CLASS}`;
export const TOOLBAR_PANEL_DEEP_LINK_PULSE_SELECTOR = `.main-city-toolbar .${TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS}`;

export const CLIENT_203_PANEL_ASSET_BY_CENTER_ID: Record<
  Client203NarrowManifestCenterPanelId,
  string
> = {
  building: PANEL_ASSET_DEFAULT,
  queue: PANEL_ASSET_QUEUE,
  hero: PANEL_ASSET_HERO,
  guild: PANEL_ASSET_GUILD,
  chat: PANEL_ASSET_CHAT,
};

export const CLIENT_203_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client203NarrowManifestCenterPanelId,
  string
> = {
  building: "building-scroll",
  queue: "queue-scroll",
  hero: "hero-scroll",
  guild: "guild-scroll",
  chat: "chat-scroll",
};

export function panelScrollClearsBottomToolbar(paddingBottomPx: number): boolean {
  return paddingBottomPx >= TOOLBAR_HEIGHT;
}

export function isWave36MainCityQueueHeroSocialHudArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryClient203PanelRoot(
  doc: ParentNode,
  panelId: Client203NarrowManifestCenterPanelId,
): HTMLElement | null {
  if (doc instanceof HTMLElement && doc.dataset.centerPanel === panelId) return doc;
  if (panelId === "building") {
    return doc.querySelector<HTMLElement>(`.building-panel[data-center-panel="building"]`);
  }
  if (panelId === "guild" || panelId === "chat") {
    return doc.querySelector<HTMLElement>(`.social-panel[data-center-panel="${panelId}"]`);
  }
  return doc.querySelector<HTMLElement>(`[data-center-panel="${panelId}"]`);
}

export function mountClient203PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isWave36MainCityQueueHeroSocialHudArtSkinOff(_root)) return;
}
