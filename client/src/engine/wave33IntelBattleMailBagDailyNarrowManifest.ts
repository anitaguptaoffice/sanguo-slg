import type { AssetLoader } from "@/engine/AssetLoader";
import {
  PANEL_ASSET_BAG,
  PANEL_ASSET_BATTLE_REPORT,
  PANEL_ASSET_DAILY,
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_MARCH,
  PANEL_ASSET_MILITARY,
} from "@/engine/artPanelSkin";
import { PANEL_FILTER_CHIP_BAR_CLASS } from "@/engine/filterListNarrowManifest";
import { TOOLBAR_HEIGHT } from "@/engine/mainCitySlots";
import { BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY } from "@/net/battleReportListState";

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-163 / CLIENT-171. */
export const WAVE33_INTEL_BATTLE_MAIL_BAG_DAILY_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-179: wave:33 军情信息卡·战报·邮件·背包·日常·军事汇总 at 1280×720.
 * Soft-deps CLIENT-172～178 wire DOM into these selectors.
 */
export const CLIENT_179_NARROW_MANIFEST_CENTER_PANEL_IDS = [
  "march",
  "battle-report",
  "mail",
  "bag",
  "daily",
  "military",
] as const;

export type Client179NarrowManifestCenterPanelId =
  (typeof CLIENT_179_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

/** CLIENT-172: read-only march intel card beside list selection. */
export const MARCH_INFO_CARD_CLASS = "march-info-card";
export const MARCH_INFO_CARD_SELECTOR = `.${MARCH_INFO_CARD_CLASS}`;
export const MARCH_INFO_PRIMARY_ROLE = "march-info-primary";
export const MARCH_INFO_SECONDARY_ROLE = "march-info-secondary";
export const MARCH_ROW_SELECTED_CLASS = "march-row-selected";

/** CLIENT-176: outcome filter chips + loaded-window summary (CLIENT-125/127 bar). */
export { BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY };
export const BATTLE_REPORT_OUTCOME_SUMMARY_CLASS = "battle-report-outcome-summary";
export const BATTLE_REPORT_OUTCOME_SUMMARY_SELECTOR = `.${BATTLE_REPORT_OUTCOME_SUMMARY_CLASS}`;
export const BATTLE_REPORT_ROW_SUMMARY_CLASS = "battle-report-row-summary";
export const BATTLE_REPORT_OUTCOME_CHIP_GROUP_SELECTOR = `.battle-report-outcome-chip-group.${PANEL_FILTER_CHIP_BAR_CLASS}`;

/** CLIENT-177: per-tab empty hints + attachment type sweep on inbox rows. */
export const MAIL_TAB_EMPTY_HINT_CLASS = "mail-tab-empty-hint";
export const MAIL_ATTACHMENT_SWEEP_CLASS = "mail-attachment-sweep";
export const MAIL_ATTACHMENT_SWEEP_SELECTOR = `.${MAIL_ATTACHMENT_SWEEP_CLASS}`;

/** CLIENT-175: cfg summary secondary line + deep-link source tag on bag panel. */
export const BAG_ITEM_CFG_SUMMARY_CLASS = "bag-item-cfg-summary";
export const BAG_ITEM_CFG_SUMMARY_SELECTOR = `.${BAG_ITEM_CFG_SUMMARY_CLASS}`;
export const BAG_OPEN_SOURCE_TAG_CLASS = "bag-open-source-v1";
export const BAG_OPEN_SOURCE_TAG_SELECTOR = `.${BAG_OPEN_SOURCE_TAG_CLASS}`;

/** CLIENT-174: thin progress bar + reward item read-only line on daily quest rows. */
export const DAILY_QUEST_PROGRESS_BAR_CLASS = "daily-quest-progress";
export const DAILY_QUEST_REWARD_LINE_CLASS = "daily-quest-reward-line";
export const DAILY_QUEST_REWARD_LINE_SELECTOR = `.${DAILY_QUEST_REWARD_LINE_CLASS}`;

/** CLIENT-178: military form read-only summary strip + intel card mutual jump. */
export const MARCH_FORM_READONLY_STRIP_CLASS = "march-form-readonly-strip";
export const MARCH_FORM_READONLY_STRIP_SELECTOR = `.${MARCH_FORM_READONLY_STRIP_CLASS}`;
export const MARCH_VIEW_INTEL_CARD_ACTION = "view-march-intel-card";
export const MARCH_VIEW_INTEL_CARD_SELECTOR = `[data-action="${MARCH_VIEW_INTEL_CARD_ACTION}"]`;
export const MARCH_OPEN_MILITARY_FROM_INTEL_ACTION = "open-military-from-march-intel";
export const MARCH_OPEN_MILITARY_FROM_INTEL_SELECTOR = `[data-action="${MARCH_OPEN_MILITARY_FROM_INTEL_ACTION}"]`;

export const CLIENT_179_PANEL_ASSET_BY_CENTER_ID: Record<
  Client179NarrowManifestCenterPanelId,
  string
> = {
  march: PANEL_ASSET_MARCH,
  "battle-report": PANEL_ASSET_BATTLE_REPORT,
  mail: PANEL_ASSET_DEFAULT,
  bag: PANEL_ASSET_BAG,
  daily: PANEL_ASSET_DAILY,
  military: PANEL_ASSET_MILITARY,
};

export const CLIENT_179_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client179NarrowManifestCenterPanelId,
  string
> = {
  march: "march-scroll",
  "battle-report": "battle-report-scroll",
  mail: "mail-scroll",
  bag: "bag-scroll",
  daily: "daily-scroll",
  military: "military-scroll",
};

export function panelScrollClearsBottomToolbar(paddingBottomPx: number): boolean {
  return paddingBottomPx >= TOOLBAR_HEIGHT;
}

export function isWave33IntelBattleMailBagDailyArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryClient179PanelRoot(
  doc: ParentNode,
  panelId: Client179NarrowManifestCenterPanelId,
): HTMLElement | null {
  if (doc instanceof HTMLElement && doc.dataset.centerPanel === panelId) {
    return doc;
  }
  if (panelId === "military") {
    return doc.querySelector<HTMLElement>(`.military-panel[data-center-panel="military"]`);
  }
  return doc.querySelector<HTMLElement>(`[data-center-panel="${panelId}"]`);
}

/** No-op skin hook; nine-slice wired in MainCityScene / panel components. */
export function mountClient179PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isWave33IntelBattleMailBagDailyArtSkinOff(_root)) return;
}
