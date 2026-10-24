import type { AssetLoader } from "@/engine/AssetLoader";
import {
  PANEL_ASSET_BATTLE_REPORT,
  PANEL_ASSET_CHAT,
  PANEL_ASSET_GUILD,
  PANEL_ASSET_MARCH,
  PANEL_ASSET_RANK,
} from "@/engine/artPanelSkin";
import { TOOLBAR_HEIGHT } from "@/engine/mainCitySlots";
import {
  MINIMAP_NARROW_EXPANDED_LAYOUT_RECT,
  resolveMinimapExpandedLayoutRect,
} from "@/ui/worldMinimap";

export const WORLD_INTEL_SOCIAL_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

export const CLIENT_145_NARROW_MANIFEST_CENTER_PANEL_IDS = [
  "march",
  "battle-report",
  "rank",
  "guild",
  "chat",
] as const;

export type Client145NarrowManifestCenterPanelId =
  (typeof CLIENT_145_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

export const WORLD_MINIMAP_NARROW_EXPANDED_LAYOUT_RECT = MINIMAP_NARROW_EXPANDED_LAYOUT_RECT;
export const resolveWorldMinimapExpandedLayoutRect = resolveMinimapExpandedLayoutRect;

export const CLIENT_145_PANEL_ASSET_BY_CENTER_ID: Record<
  Client145NarrowManifestCenterPanelId,
  string
> = {
  march: PANEL_ASSET_MARCH,
  "battle-report": PANEL_ASSET_BATTLE_REPORT,
  rank: PANEL_ASSET_RANK,
  guild: PANEL_ASSET_GUILD,
  chat: PANEL_ASSET_CHAT,
};

export const CLIENT_145_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client145NarrowManifestCenterPanelId,
  string
> = {
  march: "march-scroll",
  "battle-report": "battle-report-scroll",
  rank: "rank-scroll",
  guild: "guild-scroll",
  chat: "chat-scroll",
};

export const CLIENT_145_LIST_ROVING_ITEM_SELECTOR_BY_CENTER_ID: Record<
  "march" | "battle-report",
  string
> = {
  march: "li[data-march-id]",
  "battle-report": "li[data-report-id]",
};

export function panelScrollClearsBottomToolbar(paddingBottomPx: number): boolean {
  return paddingBottomPx >= TOOLBAR_HEIGHT;
}

export function isWorldIntelSocialArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function mountClient145PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isWorldIntelSocialArtSkinOff(_root)) return;
}
