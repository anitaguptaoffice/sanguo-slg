import type { AssetLoader } from "@/engine/AssetLoader";
import {
  PANEL_ASSET_BATTLE_REPORT,
  PANEL_ASSET_CHAT,
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_GUILD,
  PANEL_ASSET_MARCH,
  PANEL_ASSET_MILITARY,
} from "@/engine/artPanelSkin";
import { PANEL_FILTER_CHIP_BAR_CLASS } from "@/engine/panelFilterChipBarClass";

/** Same string as `filterListNarrowManifest.MAIL_CLAIM_ALL_ATTACHMENTS_ACTION` (avoid import cycle). */
export const MAIL_CLAIM_ALL_ATTACHMENTS_ACTION = "claim-mail-all";
import { TOOLBAR_HEIGHT } from "@/engine/mainCitySlots";
import {
  MARCH_QUEUE_BANNER_CLASS,
  MARCH_QUEUE_BANNER_PULSE_CLASS,
} from "@/net/marchQueueBanner";

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-127 / CLIENT-145 / CLIENT-155. */
export const WAVE31_MARCH_MAIL_SOCIAL_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-163: wave:31 出征募兵·军情·战报邻接·邮件批量·军团/聊天草稿 at 1280×720.
 * Soft-deps CLIENT-156～162 wire DOM into these selectors.
 */
export const CLIENT_163_NARROW_MANIFEST_CENTER_PANEL_IDS = [
  "military",
  "march",
  "battle-report",
  "mail",
  "guild",
  "chat",
] as const;

export type Client163NarrowManifestCenterPanelId =
  (typeof CLIENT_163_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

/** CLIENT-156: latest march summary strip on military / queue chrome. */
export { MARCH_QUEUE_BANNER_CLASS, MARCH_QUEUE_BANNER_PULSE_CLASS };
export const MARCH_QUEUE_BANNER_SELECTOR = `.${MARCH_QUEUE_BANNER_CLASS}`;

/** CLIENT-157: recruit submit → queue panel mutual jump (`MainCityScene` 查看队列). */
export const MILITARY_RECRUIT_QUEUE_JUMP_ACTION = "view-recruit-queue";
export const MILITARY_RECRUIT_QUEUE_JUMP_SELECTOR = `[data-action="${MILITARY_RECRUIT_QUEUE_JUMP_ACTION}"]`;

/** CLIENT-158: adjacent report navigation bar in battle-report detail. */
export const BATTLE_REPORT_DETAIL_NAV_CLASS = "battle-report-detail-nav";
export const BATTLE_REPORT_DETAIL_NAV_SELECTOR = `.${BATTLE_REPORT_DETAIL_NAV_CLASS}`;

/** CLIENT-159: one-click claim all unclaimed attachments on current mail tab. */
export const MAIL_CLAIM_ALL_ATTACHMENTS_SELECTOR = `[data-action="${MAIL_CLAIM_ALL_ATTACHMENTS_ACTION}"]`;

export const MAIL_INBOX_BATCH_TOOLBAR_SELECTOR = `.mail-inbox-toolbar.${PANEL_FILTER_CHIP_BAR_CLASS}`;

/** CLIENT-160: guild @mention draft memory slot above chat input. */
export const GUILD_CHAT_DRAFT_CLASS = "guild-chat-draft";
export const GUILD_CHAT_DRAFT_SELECTOR = `.${GUILD_CHAT_DRAFT_CLASS}`;

/** CLIENT-160: read-only char counter beside chat compose (matches SendChat max length). */
export const CHAT_INPUT_COUNTER_ROLE = "chat-input-counter";
export const CHAT_INPUT_COUNTER_CLASS = "chat-input-counter";
export const CHAT_INPUT_COUNTER_SELECTOR = `[data-role="${CHAT_INPUT_COUNTER_ROLE}"]`;

/** CLIENT-185: unread separator inside chat log (CLIENT-161 前身 `chat-unread-divider`). */
export const CHAT_UNREAD_SEPARATOR_CLASS = "chat-unread-separator";
export const CHAT_UNREAD_SEPARATOR_SELECTOR = `.${CHAT_UNREAD_SEPARATOR_CLASS}`;
/** @deprecated CLIENT-185 起请用 `CHAT_UNREAD_SEPARATOR_CLASS`。 */
export const CHAT_UNREAD_DIVIDER_CLASS = CHAT_UNREAD_SEPARATOR_CLASS;
/** @deprecated CLIENT-185 起请用 `CHAT_UNREAD_SEPARATOR_SELECTOR`。 */
export const CHAT_UNREAD_DIVIDER_SELECTOR = CHAT_UNREAD_SEPARATOR_SELECTOR;

/** CLIENT-162: mail filter tab badges share `mailPanelTabBadgeCounts` with HUD toolbar. */
export const MAIL_FILTER_TAB_BADGE_CLASS = "mail-filter-tab-badge";
export const MAIL_FILTER_TAB_BADGE_SELECTOR = `.${MAIL_FILTER_TAB_BADGE_CLASS}`;

export const CLIENT_163_PANEL_ASSET_BY_CENTER_ID: Record<
  Client163NarrowManifestCenterPanelId,
  string
> = {
  military: PANEL_ASSET_MILITARY,
  march: PANEL_ASSET_MARCH,
  "battle-report": PANEL_ASSET_BATTLE_REPORT,
  mail: PANEL_ASSET_DEFAULT,
  guild: PANEL_ASSET_GUILD,
  chat: PANEL_ASSET_CHAT,
};

export const CLIENT_163_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client163NarrowManifestCenterPanelId,
  string
> = {
  military: "military-scroll",
  march: "march-scroll",
  "battle-report": "battle-report-scroll",
  mail: "mail-scroll",
  guild: "guild-scroll",
  chat: "chat-scroll",
};

export const CLIENT_163_LIST_ROVING_ITEM_SELECTOR_BY_CENTER_ID: Record<"march" | "battle-report", string> =
  {
    march: "li[data-march-id]",
    "battle-report": "li[data-report-id]",
  };

export function panelScrollClearsBottomToolbar(paddingBottomPx: number): boolean {
  return paddingBottomPx >= TOOLBAR_HEIGHT;
}

export function isWave31MarchMailSocialArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryClient163PanelRoot(
  doc: ParentNode,
  panelId: Client163NarrowManifestCenterPanelId,
): HTMLElement | null {
  if (doc instanceof HTMLElement && doc.dataset.centerPanel === panelId) {
    return doc;
  }
  return doc.querySelector<HTMLElement>(`[data-center-panel="${panelId}"]`);
}

/** No-op skin hook; nine-slice wired in MainCityScene / ContentPanels. */
export function mountClient163PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isWave31MarchMailSocialArtSkinOff(_root)) return;
}
