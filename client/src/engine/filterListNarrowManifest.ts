import type { AssetLoader } from "@/engine/AssetLoader";
import { mountFilterUiSkins } from "@/engine/artUiFilterSkin";
import {
  PANEL_ASSET_BATTLE_REPORT,
  PANEL_ASSET_DAILY,
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_MARCH,
} from "@/engine/artPanelSkin";

/** Bottom toolbar height (layout-landscape) + focus-ring slack for scroll padding. */
export const FILTER_LIST_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/** CLIENT-127: center panels with ART-UI-FILTER-008 filter bars + scrollable list bodies at 1280×720. */
export const CLIENT_127_NARROW_FILTER_LIST_CENTER_PANEL_IDS = [
  "mail",
  "daily",
  "march",
  "battle-report",
] as const;

export type Client127NarrowFilterListCenterPanelId =
  (typeof CLIENT_127_NARROW_FILTER_LIST_CENTER_PANEL_IDS)[number];

/** Panel root nine-slice ids (CLIENT-086 / CLIENT-103 / mail default). */
export const CLIENT_127_PANEL_ASSET_BY_CENTER_ID: Record<
  Client127NarrowFilterListCenterPanelId,
  string
> = {
  mail: PANEL_ASSET_DEFAULT,
  daily: PANEL_ASSET_DAILY,
  march: PANEL_ASSET_MARCH,
  "battle-report": PANEL_ASSET_BATTLE_REPORT,
};

/** Scroll region `data-role` on each panel (nested in `.panel-scroll-body`). */
export const CLIENT_127_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client127NarrowFilterListCenterPanelId,
  string
> = {
  mail: "mail-scroll",
  daily: "daily-scroll",
  march: "march-scroll",
  "battle-report": "battle-report-scroll",
};

/**
 * Filter chip / phase bar roots inside each panel.
 * Soft-deps CLIENT-122～125: may add `data-ui-filter-chip` inside these bars.
 */
export const PANEL_FILTER_CHIP_BAR_CLASS = "panel-filter-chip-bar";

/** CLIENT-155 / soft-dep CLIENT-150: chain progress secondary line on daily quest rows. */
export const DAILY_QUEST_PROGRESS_SECONDARY_CLASS = "daily-quest-row-progress";

/** CLIENT-163 / soft-dep CLIENT-159: mail inbox batch toolbar hosts claim-all beside filter chips. */
export const MAIL_CLAIM_ALL_ATTACHMENTS_ACTION = "claim-mail-all";

export const CLIENT_127_FILTER_CHIP_BAR_SELECTOR_BY_CENTER_ID: Record<
  Client127NarrowFilterListCenterPanelId,
  string
> = {
  mail: `.mail-inbox-toolbar.${PANEL_FILTER_CHIP_BAR_CLASS}`,
  daily: `.daily-quest-filters.${PANEL_FILTER_CHIP_BAR_CLASS}`,
  march: `.march-list-filter.${PANEL_FILTER_CHIP_BAR_CLASS}`,
  "battle-report": `.battle-report-filters.${PANEL_FILTER_CHIP_BAR_CLASS}`,
};

export function isFilterListArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryFilterListPanelRoot(
  doc: ParentNode,
  panelId: Client127NarrowFilterListCenterPanelId,
): HTMLElement | null {
  if (doc instanceof HTMLElement && doc.dataset.centerPanel === panelId) {
    return doc;
  }
  return doc.querySelector<HTMLElement>(`[data-center-panel="${panelId}"]`);
}

export function queryFilterChipBar(
  panelRoot: HTMLElement,
  panelId: Client127NarrowFilterListCenterPanelId,
): HTMLElement | null {
  const sel = CLIENT_127_FILTER_CHIP_BAR_SELECTOR_BY_CENTER_ID[panelId];
  return panelRoot.querySelector<HTMLElement>(sel);
}

/** Wire ART-UI-FILTER-008 mounts when panels opt in via data attributes (no-op until CLIENT-122～126). */
export function mountFilterListPanelSkins(root: HTMLElement, assets: AssetLoader): void {
  if (isFilterListArtSkinOff(root)) return;
  mountFilterUiSkins(root, assets);
}
