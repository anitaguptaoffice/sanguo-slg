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
import { MAIN_CITY_SLOT_OVERLAY_LAYER_SELECTOR } from "@/engine/mainCityHeroHudNarrowManifest";
import {
  HUD_RESOURCE_STRIP_SELECTOR,
  HUD_RESOURCE_SWEEP_SELECTOR,
  RANK_VIEWER_BAR_CLASS,
} from "@/engine/mainCityWave30NarrowManifest";
import { TOOLBAR_HEIGHT } from "@/engine/mainCitySlots";
import {
  CHAT_UNREAD_DIVIDER_CLASS,
  CHAT_UNREAD_DIVIDER_SELECTOR,
  CHAT_UNREAD_SEPARATOR_CLASS,
  CHAT_UNREAD_SEPARATOR_SELECTOR,
} from "@/engine/wave31MarchMailSocialNarrowManifest";
import {
  CITY_SLOT_PULSE_CLASS,
  QUEUE_ROW_SLOT_HIGHLIGHT_CLASS,
} from "@/net/citySlotQueueLink";
import { DAILY_QUEUE_ANCHOR_HIGHLIGHT_CLASS } from "@/net/dailyQueueAnchor";
import { formatHeroListRefreshedAt } from "@/net/formatHeroListRefreshedAt";
import { HERO_LIST_REFRESH_PULSE_CLASS } from "@/net/heroListRefreshFeedback";
import { HERO_LIST_SELECTED_SESSION_KEY } from "@/net/heroListSelectedSession";
import { formatHudProductionWalletLine } from "@/net/hudQueueCompletePulse";
import {
  formatLeaderboardTopDensityLine,
  leaderboardTopDensityEntries,
} from "@/net/leaderboardFormat";
import {
  RECRUIT_SUCCESS_PULSE_CLASS,
  RECRUIT_SUBMITTING_CLASS,
} from "@/net/recruitSubmitFeedback";
import { formatChatUnreadSweepLine } from "@/net/chatUnread";
import { groupGuildMembersByRole } from "@/net/socialFormat";

/** CLIENT-184 密度行 DOM（`SocialPanels` 表行 `rank-top-density-row`；manifest 亦登记 line class）。 */
export const RANK_TOP_DENSITY_ROW_CLASS = "rank-top-density-row";
export const LEADERBOARD_TOP_DENSITY_LINE_CLASS = "leaderboard-top-density-line";

/** CLIENT-181 sweep 次行；manifest 预留同名 role 供窄屏选择器（与 `hud-resource-sweep` 并存）。 */
export const HUD_PRODUCTION_WALLET_LINE_ROLE = "hud-production-wallet-line";
/** CLIENT-182 列表刷新戳记 `data-role`（`HeroMailPanels` DOM）。 */
export const HERO_LIST_REFRESH_STAMP_ROLE = "hero-list-refreshed-at";

export const WAVE34_MAIN_CITY_HERO_RANK_SOCIAL_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/** CLIENT-187: wave:34 主城七槽·将领·排行·军团/聊天·HUD·队列日常锚点 at 1280×720. */
export const CLIENT_187_NARROW_MANIFEST_CENTER_PANEL_IDS = [
  "building",
  "queue",
  "hero",
  "rank",
  "guild",
  "chat",
  "daily",
] as const;

export type Client187NarrowManifestCenterPanelId =
  (typeof CLIENT_187_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

export {
  MAIN_CITY_SLOT_OVERLAY_LAYER_SELECTOR,
  CITY_SLOT_PULSE_CLASS,
  QUEUE_ROW_SLOT_HIGHLIGHT_CLASS,
  formatHudProductionWalletLine,
  HUD_RESOURCE_STRIP_SELECTOR,
  HUD_RESOURCE_SWEEP_SELECTOR,
  HERO_LIST_SELECTED_SESSION_KEY,
  formatHeroListRefreshedAt,
  HERO_LIST_REFRESH_PULSE_CLASS,
  RECRUIT_SUBMITTING_CLASS,
  RECRUIT_SUCCESS_PULSE_CLASS,
  formatLeaderboardTopDensityLine,
  leaderboardTopDensityEntries,
  RANK_VIEWER_BAR_CLASS,
  CHAT_UNREAD_SEPARATOR_CLASS,
  CHAT_UNREAD_SEPARATOR_SELECTOR,
  CHAT_UNREAD_DIVIDER_CLASS,
  CHAT_UNREAD_DIVIDER_SELECTOR,
  formatChatUnreadSweepLine,
  groupGuildMembersByRole,
  DAILY_QUEUE_ANCHOR_HIGHLIGHT_CLASS,
};

export const GUILD_ROLE_GROUP_HEADER_CLASS = "guild-role-group-header"; // CLIENT-185
export const CITY_SLOT_PULSE_SELECTOR = `.main-city-slot-upgrade-tag.${CITY_SLOT_PULSE_CLASS}`;
export const QUEUE_ROW_SLOT_HIGHLIGHT_SELECTOR = `.queue-list-row.${QUEUE_ROW_SLOT_HIGHLIGHT_CLASS}`;
export const HUD_PRODUCTION_WALLET_LINE_SELECTOR = `[data-role="${HUD_PRODUCTION_WALLET_LINE_ROLE}"]`;
export const LEADERBOARD_TOP_DENSITY_LINE_SELECTOR = `.${LEADERBOARD_TOP_DENSITY_LINE_CLASS}`;
export const GUILD_ROLE_GROUP_HEADER_SELECTOR = `.guild-members li.${GUILD_ROLE_GROUP_HEADER_CLASS}`;
export const DAILY_QUEUE_ANCHOR_HIGHLIGHT_SELECTOR = `.queue-list-row.${DAILY_QUEUE_ANCHOR_HIGHLIGHT_CLASS}, .daily-quest-list li.${DAILY_QUEUE_ANCHOR_HIGHLIGHT_CLASS}`;

export const CLIENT_187_PANEL_ASSET_BY_CENTER_ID: Record<
  Client187NarrowManifestCenterPanelId,
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

export const CLIENT_187_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client187NarrowManifestCenterPanelId,
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

export function isWave34MainCityHeroRankSocialHudArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryClient187PanelRoot(
  doc: ParentNode,
  panelId: Client187NarrowManifestCenterPanelId,
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

export function mountClient187PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isWave34MainCityHeroRankSocialHudArtSkinOff(_root)) return;
}
