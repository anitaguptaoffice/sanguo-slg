import type { AssetLoader } from "@/engine/AssetLoader";
import {
  PANEL_ASSET_BATTLE_REPORT,
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_MARCH,
  PANEL_ASSET_MILITARY,
  PANEL_ASSET_WORLD,
} from "@/engine/artPanelSkin";
import { TOOLBAR_HEIGHT } from "@/engine/mainCitySlots";
import {
  BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY,
  MARCH_INFO_CARD_CLASS,
  MARCH_ROW_SELECTED_CLASS,
} from "@/engine/wave33IntelBattleMailBagDailyNarrowManifest";
import {
  MARCH_INTEL_PHASE_ETA_STRIP_CLASS,
  MINIMAP_MARCH_STACK_BADGE_CLASS,
  WORLD_TILE_MARCH_SUMMARY_LINE_CLASS,
} from "@/engine/wave37WorldIntelBattleReportMailBagNarrowManifest";
import {
  INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_CLASS,
  INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_SELECTOR,
  MINIMAP_INTEL_SYNC_RING_CLASS,
  MINIMAP_INTEL_SYNC_RING_SELECTOR,
} from "@/engine/wave39MinimapIntelSyncNarrowManifest";
import { INTEL_PHASE_CHANGE_FLASH_CLASS } from "@/net/marchIntelPhaseChangeFlash";

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-211 / CLIENT-219. */
export const WAVE39_WORLD_INTEL_BATTLE_REPORT_MAIL_MARCH_HUD_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-227: wave:39 世界·军情·战报·邮件·出征·HUD 军事待办组合窄屏 manifest at 1280×720.
 * Soft-deps CLIENT-220～226 wire DOM into these selectors.
 */
export const CLIENT_227_NARROW_MANIFEST_CENTER_PANEL_IDS = [
  "world",
  "march",
  "military",
  "battle-report",
  "mail",
] as const;

export type Client227NarrowManifestCenterPanelId =
  (typeof CLIENT_227_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

/** CLIENT-222: post-submit intel handoff line + new march row highlight. */
export const INTEL_NEW_MARCH_HIGHLIGHT_CLASS = "intel-new-march-highlight";
export const MARCH_SUBMIT_INTEL_HANDOFF_LINE_CLASS = "march-submit-intel-handoff-line";

/** CLIENT-223: battle report list coordinate tag → intel / minimap jump. */
export const REPORT_LIST_INTEL_JUMP_TAG_CLASS = "report-list-intel-jump-tag";

/** CLIENT-224: detail round summary strip → intel march link. */
export const REPORT_ROUND_SUMMARY_INTEL_LINK_CLASS = "report-round-summary-intel-link";
export const OPEN_INTEL_FOR_REPORT_ACTION = "open-intel-for-report";

/** CLIENT-225: mail battle tab sweep + outcome filter session bridge. */
export const REPORT_OUTCOME_FILTER_BRIDGE_SESSION_KEY = "report-outcome-filter-bridge-v1";
export const MAIL_BATTLE_CATEGORY_SWEEP_LINE_CLASS = "mail-battle-category-sweep-line";

/** CLIENT-226: HUD military todo segments (coexists with CLIENT-216 merged sweep). */
export const HUD_MILITARY_TODO_SWEEP_CLASS = "hud-military-todo-sweep";
export const HUD_MILITARY_TODO_SWEEP_LINE_ROLE = "hud-military-todo-sweep-line";
export const HUD_MILITARY_TODO_PULSE_CLASS = "hud-military-todo-pulse";

export {
  BATTLE_REPORT_OUTCOME_FILTER_SESSION_KEY,
  INTEL_PHASE_CHANGE_FLASH_CLASS,
  INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_CLASS,
  INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_SELECTOR,
  MARCH_INFO_CARD_CLASS,
  MARCH_INTEL_PHASE_ETA_STRIP_CLASS,
  MARCH_ROW_SELECTED_CLASS,
  MINIMAP_INTEL_SYNC_RING_CLASS,
  MINIMAP_INTEL_SYNC_RING_SELECTOR,
  MINIMAP_MARCH_STACK_BADGE_CLASS,
  WORLD_TILE_MARCH_SUMMARY_LINE_CLASS,
};

export const INTEL_PHASE_CHANGE_FLASH_SELECTOR = `.march-list li.${INTEL_PHASE_CHANGE_FLASH_CLASS}`;
export const INTEL_NEW_MARCH_HIGHLIGHT_SELECTOR = `.march-list li.${INTEL_NEW_MARCH_HIGHLIGHT_CLASS}`;
export const MARCH_SUBMIT_INTEL_HANDOFF_LINE_SELECTOR = `.${MARCH_SUBMIT_INTEL_HANDOFF_LINE_CLASS}`;
export const REPORT_LIST_INTEL_JUMP_TAG_SELECTOR = `.battle-report-list li .${REPORT_LIST_INTEL_JUMP_TAG_CLASS}`;
export const REPORT_ROUND_SUMMARY_INTEL_LINK_SELECTOR = `.${REPORT_ROUND_SUMMARY_INTEL_LINK_CLASS}, [data-action="${OPEN_INTEL_FOR_REPORT_ACTION}"]`;
export const MAIL_BATTLE_CATEGORY_SWEEP_LINE_SELECTOR = `.mail-inbox-toolbar .${MAIL_BATTLE_CATEGORY_SWEEP_LINE_CLASS}`;
export const HUD_MILITARY_TODO_SWEEP_LINE_SELECTOR = `#hud .${HUD_MILITARY_TODO_SWEEP_CLASS}, [data-role="${HUD_MILITARY_TODO_SWEEP_LINE_ROLE}"]`;
export const HUD_MILITARY_TODO_PULSE_SELECTOR = `.main-city-toolbar button.${HUD_MILITARY_TODO_PULSE_CLASS}`;

export const CLIENT_227_PANEL_ASSET_BY_CENTER_ID: Record<
  Client227NarrowManifestCenterPanelId,
  string
> = {
  world: PANEL_ASSET_WORLD,
  march: PANEL_ASSET_MARCH,
  military: PANEL_ASSET_MILITARY,
  "battle-report": PANEL_ASSET_BATTLE_REPORT,
  mail: PANEL_ASSET_DEFAULT,
};

export const CLIENT_227_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client227NarrowManifestCenterPanelId,
  string
> = {
  world: "world-scroll",
  march: "march-scroll",
  military: "military-scroll",
  "battle-report": "battle-report-scroll",
  mail: "mail-scroll",
};

export function panelScrollClearsBottomToolbar(paddingBottomPx: number): boolean {
  return paddingBottomPx >= TOOLBAR_HEIGHT;
}

export function isWave39WorldIntelBattleReportMailMarchHudArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryClient227PanelRoot(
  doc: ParentNode,
  panelId: Client227NarrowManifestCenterPanelId,
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
export function mountClient227PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isWave39WorldIntelBattleReportMailMarchHudArtSkinOff(_root)) return;
}
