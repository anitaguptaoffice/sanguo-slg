import type { AssetLoader } from "@/engine/AssetLoader";
import {
  PANEL_ASSET_CHAT,
  PANEL_ASSET_DAILY,
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_GUILD,
  PANEL_ASSET_HERO,
  PANEL_ASSET_QUEUE,
  PANEL_ASSET_RANK,
  PANEL_ASSET_SHOP,
} from "@/engine/artPanelSkin";
import { TOOLBAR_HEIGHT } from "@/engine/mainCitySlots";
import { DOMESTIC_QUEUE_COMPLETE_SLOT_MARGIN_CLASS } from "@/net/domesticQueueCompleteSlotMargin";
import {
  DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_CLASS,
  formatDomesticQueueEtaSegmentLabel,
} from "@/net/domesticQueueEtaSegment";
import { GUILD_CHAT_BACKOFF_RETRY_CLASS } from "@/net/guildChatGatewayBackoff";
import { HERO_DETAIL_CONSUMABLE_STACK_LINE_CLASS } from "@/net/heroDetailConsumableStackLine";
import { formatHeroDetailConsumableStackLine } from "@/net/heroDetailConsumableStackLine";
import {
  HERO_LIST_LOYALTY_SUBLINE_CLASS,
  HERO_LIST_LOYALTY_SUBLINE_ROLE,
  HERO_LOYALTY_WARN_DOT_CLASS,
  formatHeroListLoyaltySubline,
} from "@/net/heroListLoyaltySubline";
import {
  CENTER_PANEL_TAB_PULSE_CLASS,
  HUD_CENTER_PANEL_DEEPLINK_LINE_ROLE,
} from "@/net/hudCenterPanelDeepLink";
import {
  formatHudTodoMergedSweepLine,
  HUD_TODO_MERGED_SWEEP_FACET_ATTR,
  HUD_TODO_MERGED_SWEEP_LINE_ROLE,
  resolveToolbarPanelFromHudTodo,
  TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS,
  TOOLBAR_PANEL_DEEP_LINK_PULSE_MS,
} from "@/net/hudTodoMergedSweep";
import {
  formatNextQueueFinishPreviewLine,
  QUEUE_NEXT_FINISH_PREVIEW_ACTION,
  QUEUE_NEXT_FINISH_PREVIEW_CLASS,
} from "@/net/nextQueueFinishPreview";
import {
  CITY_SLOT_COMPLETE_FOCUS_RING_CLASS,
  QUEUE_ROW_COMPLETE_PULSE_CLASS,
} from "@/net/queueCompleteFocusRing";
import {
  QUEUE_ROW_ETA_LINE_CLASS,
  QUEUE_ROW_PROGRESS_BAR_CLASS,
} from "@/net/queueRemainingEtaLine";
import {
  DAILY_QUEST_CHAIN_TYPE_SUBLINE_CLASS,
  formatQuestChainTypeSubline,
} from "@/net/questChainTypeSubline";
import {
  formatRankRefreshCooldownStamp,
  RANK_EMPTY_RETRY_INLINE_CLASS,
  RANK_MANUAL_REFRESH_SESSION_KEY,
  RANK_REFRESH_COOLDOWN_STAMP_CLASS,
  RANK_REFRESH_COOLDOWN_STAMP_ROLE,
} from "@/net/rankRefreshCooldown";
import {
  RECRUIT_WALLET_COMPARE_LINE_CLASS,
  RECRUIT_WALLET_COMPARE_LINE_ROLE,
} from "@/net/recruitWalletCompare";
import {
  SHOP_WALLET_COMPARE_LINE_CLASS,
  SHOP_WALLET_COMPARE_LINE_ROLE,
} from "@/net/shopTabCurrency";
import {
  formatGuildMemberOnlineSummaryLine,
  GUILD_MEMBER_ONLINE_SUMMARY_CLASS,
} from "@/net/socialFormat";

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-203 / CLIENT-211. */
export const WAVE38_MAIN_CITY_HERO_SOCIAL_QUEUE_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/** HUD 合并待办行 DOM class（CLIENT-216；与 `data-role` 并存）。 */
export const HUD_TODO_MERGED_SWEEP_CLASS = "hud-todo-merged-sweep";

/** CLIENT-217：`data-role` 与 `SocialPanels` DOM 一致。 */
export const GUILD_MEMBER_ONLINE_SUMMARY_ROLE = "guild-member-online-summary";

/**
 * CLIENT-219: wave:38 主城·将领·社交·队列·HUD 深链组合窄屏 manifest at 1280×720.
 * Soft-deps CLIENT-212～218 wire DOM into these selectors.
 */
export const CLIENT_219_NARROW_MANIFEST_CENTER_PANEL_IDS = [
  "building",
  "queue",
  "hero",
  "rank",
  "guild",
  "chat",
  "daily",
  "shop",
] as const;

export type Client219NarrowManifestCenterPanelId =
  (typeof CLIENT_219_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

export {
  QUEUE_ROW_ETA_LINE_CLASS,
  QUEUE_ROW_PROGRESS_BAR_CLASS,
  CITY_SLOT_COMPLETE_FOCUS_RING_CLASS,
  QUEUE_ROW_COMPLETE_PULSE_CLASS,
  HUD_CENTER_PANEL_DEEPLINK_LINE_ROLE,
  CENTER_PANEL_TAB_PULSE_CLASS,
  DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_CLASS,
  DOMESTIC_QUEUE_COMPLETE_SLOT_MARGIN_CLASS,
  formatDomesticQueueEtaSegmentLabel,
  HERO_LIST_LOYALTY_SUBLINE_CLASS,
  HERO_LIST_LOYALTY_SUBLINE_ROLE,
  HERO_LOYALTY_WARN_DOT_CLASS,
  HERO_DETAIL_CONSUMABLE_STACK_LINE_CLASS,
  formatHeroListLoyaltySubline,
  formatHeroDetailConsumableStackLine,
  RANK_REFRESH_COOLDOWN_STAMP_CLASS,
  RANK_REFRESH_COOLDOWN_STAMP_ROLE,
  RANK_EMPTY_RETRY_INLINE_CLASS,
  RANK_MANUAL_REFRESH_SESSION_KEY,
  formatRankRefreshCooldownStamp,
  RECRUIT_WALLET_COMPARE_LINE_CLASS,
  RECRUIT_WALLET_COMPARE_LINE_ROLE,
  SHOP_WALLET_COMPARE_LINE_CLASS,
  SHOP_WALLET_COMPARE_LINE_ROLE,
  HUD_TODO_MERGED_SWEEP_LINE_ROLE,
  HUD_TODO_MERGED_SWEEP_FACET_ATTR,
  TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS,
  TOOLBAR_PANEL_DEEP_LINK_PULSE_MS,
  formatHudTodoMergedSweepLine,
  resolveToolbarPanelFromHudTodo,
  GUILD_MEMBER_ONLINE_SUMMARY_CLASS,
  GUILD_CHAT_BACKOFF_RETRY_CLASS,
  formatGuildMemberOnlineSummaryLine,
  DAILY_QUEST_CHAIN_TYPE_SUBLINE_CLASS,
  formatQuestChainTypeSubline,
  QUEUE_NEXT_FINISH_PREVIEW_CLASS,
  QUEUE_NEXT_FINISH_PREVIEW_ACTION,
  formatNextQueueFinishPreviewLine,
};

export const DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_SELECTOR = `.queue-list li .${DOMESTIC_QUEUE_ETA_SEGMENT_LABEL_CLASS}`;
export const DOMESTIC_QUEUE_COMPLETE_SLOT_MARGIN_SELECTOR = `.main-city-slot-upgrade-tag .${DOMESTIC_QUEUE_COMPLETE_SLOT_MARGIN_CLASS}, .main-city-slot-overlay .${DOMESTIC_QUEUE_COMPLETE_SLOT_MARGIN_CLASS}`;
export const HERO_LIST_LOYALTY_SUBLINE_SELECTOR = `.hero-list li .${HERO_LIST_LOYALTY_SUBLINE_CLASS}, .hero-list li [data-role="${HERO_LIST_LOYALTY_SUBLINE_ROLE}"]`;
export const HERO_LOYALTY_WARN_DOT_SELECTOR = `.${HERO_LOYALTY_WARN_DOT_CLASS}`;
export const HERO_DETAIL_CONSUMABLE_STACK_LINE_SELECTOR = `.${HERO_DETAIL_CONSUMABLE_STACK_LINE_CLASS}`;
export const RANK_REFRESH_COOLDOWN_STAMP_SELECTOR = `.rank-panel .${RANK_REFRESH_COOLDOWN_STAMP_CLASS}, [data-role="${RANK_REFRESH_COOLDOWN_STAMP_ROLE}"]`;
export const RANK_EMPTY_RETRY_INLINE_SELECTOR = `.${RANK_EMPTY_RETRY_INLINE_CLASS}`;
export const RECRUIT_WALLET_COMPARE_LINE_SELECTOR = `.${RECRUIT_WALLET_COMPARE_LINE_CLASS}, [data-role="${RECRUIT_WALLET_COMPARE_LINE_ROLE}"]`;
export const SHOP_WALLET_COMPARE_LINE_SELECTOR = `.${SHOP_WALLET_COMPARE_LINE_CLASS}, [data-role="${SHOP_WALLET_COMPARE_LINE_ROLE}"]`;
export const HUD_TODO_MERGED_SWEEP_LINE_SELECTOR = `#hud .${HUD_TODO_MERGED_SWEEP_CLASS}, [data-role="${HUD_TODO_MERGED_SWEEP_LINE_ROLE}"]`;
export const TOOLBAR_PANEL_DEEP_LINK_PULSE_SELECTOR = `.main-city-toolbar button.${TOOLBAR_PANEL_DEEP_LINK_PULSE_CLASS}`;
export const GUILD_MEMBER_ONLINE_SUMMARY_SELECTOR = `.social-panel .${GUILD_MEMBER_ONLINE_SUMMARY_CLASS}, [data-role="${GUILD_MEMBER_ONLINE_SUMMARY_ROLE}"]`;
export const GUILD_CHAT_BACKOFF_RETRY_SELECTOR = `.${GUILD_CHAT_BACKOFF_RETRY_CLASS}`;
export const DAILY_QUEST_CHAIN_TYPE_SUBLINE_SELECTOR = `.daily-quest-list li .${DAILY_QUEST_CHAIN_TYPE_SUBLINE_CLASS}`;
export const QUEUE_NEXT_FINISH_PREVIEW_SELECTOR = `.${QUEUE_NEXT_FINISH_PREVIEW_CLASS}, [data-action="${QUEUE_NEXT_FINISH_PREVIEW_ACTION}"]`;

export const CLIENT_219_PANEL_ASSET_BY_CENTER_ID: Record<
  Client219NarrowManifestCenterPanelId,
  string
> = {
  building: PANEL_ASSET_DEFAULT,
  queue: PANEL_ASSET_QUEUE,
  hero: PANEL_ASSET_HERO,
  rank: PANEL_ASSET_RANK,
  guild: PANEL_ASSET_GUILD,
  chat: PANEL_ASSET_CHAT,
  daily: PANEL_ASSET_DAILY,
  shop: PANEL_ASSET_SHOP,
};

export const CLIENT_219_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client219NarrowManifestCenterPanelId,
  string
> = {
  building: "building-scroll",
  queue: "queue-scroll",
  hero: "hero-scroll",
  rank: "rank-scroll",
  guild: "guild-scroll",
  chat: "chat-scroll",
  daily: "daily-scroll",
  shop: "shop-scroll",
};

export function panelScrollClearsBottomToolbar(paddingBottomPx: number): boolean {
  return paddingBottomPx >= TOOLBAR_HEIGHT;
}

export function isWave38MainCityHeroSocialQueueArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryClient219PanelRoot(
  doc: ParentNode,
  panelId: Client219NarrowManifestCenterPanelId,
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

export function mountClient219PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isWave38MainCityHeroSocialQueueArtSkinOff(_root)) return;
}
