import type { AssetLoader } from "@/engine/AssetLoader";
import {
  PANEL_ASSET_BAG,
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_DAILY,
  PANEL_ASSET_GUILD,
  PANEL_ASSET_HERO,
  PANEL_ASSET_QUEUE,
} from "@/engine/artPanelSkin";

/** CLIENT-230: manifest id for hero panel nine-slice mount. */
export const HERO_PANEL_ART_MOUNT_ID = PANEL_ASSET_HERO;
import { TOOLBAR_HEIGHT } from "@/engine/mainCitySlots";
import { HERO_LIST_FILTER_SESSION_KEY } from "@/net/heroListFilter";
import { HERO_LIST_RETURN_HIGHLIGHT_CLASS } from "@/engine/wave36MainCityQueueHeroSocialHudNarrowManifest";
import { GUILD_ROLE_GROUP_HEADER_CLASS } from "@/engine/wave34MainCityHeroRankSocialHudNarrowManifest";

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-219 / CLIENT-227. */
export const WAVE40_MAIN_CITY_HERO_BAG_DAILY_GUILD_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-235: wave:40 主城·将领·背包·日常·军团组合窄屏 manifest at 1280×720.
 * Soft-deps CLIENT-228～234 wire DOM into these selectors.
 */
export const CLIENT_235_NARROW_MANIFEST_CENTER_PANEL_IDS = [
  "building",
  "queue",
  "hero",
  "bag",
  "daily",
  "guild",
] as const;

export type Client235NarrowManifestCenterPanelId =
  (typeof CLIENT_235_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

/** CLIENT-228: 七槽 ↔ 队列双向焦点抛光环。 */
export const DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS = "domestic-slot-queue-focus-ring";

/** CLIENT-229: 队列返回主城槽位滚动锚点与 ring 记忆。 */
export const DOMESTIC_SLOT_RETURN_RING_CLASS = "domestic-slot-return-ring";
export const DOMESTIC_SLOT_SCROLL_SESSION_KEY = "domestic-slot-scroll-v1";

/** CLIENT-230: 将领面板 hero 壳挂载（工程接线；非 ART-012 任务 ID）。 */
export const HERO_PANEL_ART_MOUNT_ATTR = "data-art-panel";

/** CLIENT-231: 列表↔详情返回高亮（筛选记忆与 CLIENT-151 并存）。 */
export { HERO_LIST_FILTER_SESSION_KEY, HERO_LIST_RETURN_HIGHLIGHT_CLASS };

/** CLIENT-232: UseConsumable 行内脉冲与经济错误行。 */
export const BAG_USE_CONSUMABLE_PULSE_CLASS = "bag-use-consumable-pulse";
export const BAG_USE_ECONOMY_ERROR_LINE_CLASS = "bag-use-economy-error-line";

/** CLIENT-233: 日常首条可领滚入视区与领取进度脉冲。 */
export const QUEST_CLAIMABLE_SCROLL_ANCHOR_ROLE = "daily-claimable-scroll-anchor";
export const QUEST_CLAIM_PROGRESS_PULSE_CLASS = "quest-claim-progress-pulse";

/** CLIENT-234: 军团职务分组头与聊天未读分隔抛光（与 CLIENT-185/161 并存）。 */
export { GUILD_ROLE_GROUP_HEADER_CLASS };
export const GUILD_ROLE_GROUP_HEADER_LINE_ROLE = "guild-role-group-header-line";
export const GUILD_CHAT_UNREAD_SEPARATOR_CLASS = "guild-chat-unread-separator";

export const DOMESTIC_SLOT_QUEUE_FOCUS_RING_SELECTOR = `.main-city-slot-overlay .${DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS}, .main-city-slot-upgrade-tag .${DOMESTIC_SLOT_QUEUE_FOCUS_RING_CLASS}`;
export const DOMESTIC_SLOT_RETURN_RING_SELECTOR = `.main-city-slot-overlay .${DOMESTIC_SLOT_RETURN_RING_CLASS}, .main-city-slot-upgrade-tag .${DOMESTIC_SLOT_RETURN_RING_CLASS}`;
export const HERO_PANEL_ART_MOUNT_SELECTOR = `.content-panel[data-center-panel="hero"][${HERO_PANEL_ART_MOUNT_ATTR}="${HERO_PANEL_ART_MOUNT_ID}"]`;
export const HERO_LIST_RETURN_HIGHLIGHT_SELECTOR = `.hero-list li.${HERO_LIST_RETURN_HIGHLIGHT_CLASS}`;
export const BAG_USE_CONSUMABLE_PULSE_SELECTOR = `.bag-list li .${BAG_USE_CONSUMABLE_PULSE_CLASS}`;
export const BAG_USE_ECONOMY_ERROR_LINE_SELECTOR = `.bag-list .${BAG_USE_ECONOMY_ERROR_LINE_CLASS}`;
export const QUEST_CLAIMABLE_SCROLL_ANCHOR_SELECTOR = `.daily-quest-list [data-role="${QUEST_CLAIMABLE_SCROLL_ANCHOR_ROLE}"]`;
export const QUEST_CLAIM_PROGRESS_PULSE_SELECTOR = `.daily-quest-list li .${QUEST_CLAIM_PROGRESS_PULSE_CLASS}`;
export const GUILD_ROLE_GROUP_HEADER_LINE_SELECTOR = `.guild-members [data-role="${GUILD_ROLE_GROUP_HEADER_LINE_ROLE}"]`;
export const GUILD_CHAT_UNREAD_SEPARATOR_SELECTOR = `.chat-log li.${GUILD_CHAT_UNREAD_SEPARATOR_CLASS}`;

export const CLIENT_235_PANEL_ASSET_BY_CENTER_ID: Record<
  Client235NarrowManifestCenterPanelId,
  string
> = {
  building: PANEL_ASSET_DEFAULT,
  queue: PANEL_ASSET_QUEUE,
  hero: PANEL_ASSET_HERO,
  bag: PANEL_ASSET_BAG,
  daily: PANEL_ASSET_DAILY,
  guild: PANEL_ASSET_GUILD,
};

export const CLIENT_235_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client235NarrowManifestCenterPanelId,
  string
> = {
  building: "building-scroll",
  queue: "queue-scroll",
  hero: "hero-scroll",
  bag: "bag-scroll",
  daily: "daily-scroll",
  guild: "guild-scroll",
};

export function panelScrollClearsBottomToolbar(paddingBottomPx: number): boolean {
  return paddingBottomPx >= TOOLBAR_HEIGHT;
}

export function isWave40MainCityHeroBagDailyGuildArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function resolveHeroPanelArtMount(root: HTMLElement): boolean {
  if (isWave40MainCityHeroBagDailyGuildArtSkinOff(root)) return false;
  return root.getAttribute(HERO_PANEL_ART_MOUNT_ATTR) === HERO_PANEL_ART_MOUNT_ID;
}

export function queryClient235PanelRoot(
  doc: ParentNode,
  panelId: Client235NarrowManifestCenterPanelId,
): HTMLElement | null {
  if (doc instanceof HTMLElement && doc.dataset.centerPanel === panelId) return doc;
  if (panelId === "building") {
    return doc.querySelector<HTMLElement>(`.building-panel[data-center-panel="building"]`);
  }
  if (panelId === "guild") {
    return doc.querySelector<HTMLElement>(`.social-panel[data-center-panel="guild"]`);
  }
  return doc.querySelector<HTMLElement>(`[data-center-panel="${panelId}"]`);
}

export function mountClient235PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isWave40MainCityHeroBagDailyGuildArtSkinOff(_root)) return;
}
