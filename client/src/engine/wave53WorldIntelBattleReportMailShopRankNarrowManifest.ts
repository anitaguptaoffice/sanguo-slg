import type { AssetLoader } from "@/engine/AssetLoader";
import {
  CLIENT_323_NARROW_MANIFEST_CENTER_PANEL_IDS,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS,
  isWave51WorldIntelBattleReportMailShopRankArtSkinOff,
  mountClient323PanelSkins,
  panelScrollClearsBottomToolbar,
  pulseWave51ResidualNarrowHook,
  queryClient323PanelRoot,
  type Client323NarrowManifestCenterPanelId,
} from "@/engine/wave51WorldIntelBattleReportMailShopRankNarrowManifest";
import { TOOLBAR_HEIGHT } from "@/engine/mainCitySlots";

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-323 / CLIENT-331. */
export const WAVE53_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-339 stub: wave:53 世界·军情·战报·邮件·商城·排行组合窄屏 manifest 巩固再加深三层 at 1280×720.
 * Soft-deps CLIENT-332～338 wire DOM into these selectors (**非** wave:52 CLIENT-331 主城栈面板集).
 */
export const CLIENT_339_NARROW_MANIFEST_CENTER_PANEL_IDS = CLIENT_323_NARROW_MANIFEST_CENTER_PANEL_IDS;

export type Client339NarrowManifestCenterPanelId = Client323NarrowManifestCenterPanelId;

/** CLIENT-332: minimap scroll-sync residual deepest-deepest-deeper ring on CLIENT-316 deepest-deeper ring. */
export const MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS =
  "minimap-intel-scroll-sync-residual-deepest-deepest-deeper-ring";

/** CLIENT-332: world tile ETA cross-read residual deepest-deepest-deeper line (CLIENT-316 baseline). */
export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_CLASS =
  "world-tile-intel-eta-cross-residual-deepest-deepest-deeper-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS =
  "world-tile-intel-eta-cross-residual-deepest-deepest-deeper-pulse";

/** Wave:51 baselines that must not regress alongside wave:53 residual deepest-deepest-deeper hooks. */
export {
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPER_RING_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS,
};

export function wave53PanelScrollClearsBottomToolbar(paddingBottomPx: number): boolean {
  return panelScrollClearsBottomToolbar(paddingBottomPx) && paddingBottomPx >= TOOLBAR_HEIGHT;
}

export function isWave53WorldIntelBattleReportMailShopRankArtSkinOff(el: HTMLElement): boolean {
  return isWave51WorldIntelBattleReportMailShopRankArtSkinOff(el);
}

export function queryClient339PanelRoot(
  doc: ParentNode,
  panelId: Client339NarrowManifestCenterPanelId,
): HTMLElement | null {
  return queryClient323PanelRoot(doc, panelId);
}

/** Safe no-op when CLIENT-332～338 sibling DOM is not mounted yet. */
export function pulseWave53ResidualNarrowHook(root: ParentNode, selector: string): void {
  pulseWave51ResidualNarrowHook(root, selector);
}

/** No-op skin hook until CLIENT-339 consolidates panel skins. */
export function mountClient339PanelSkins(root: HTMLElement, assets: AssetLoader): void {
  mountClient323PanelSkins(root, assets);
}
