import {
  CLIENT_339_NARROW_MANIFEST_CENTER_PANEL_IDS,
  type Client339NarrowManifestCenterPanelId,
} from "@/engine/wave53WorldIntelBattleReportMailShopRankNarrowManifest";

export const WAVE55_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-355: wave:55 世界·军情·战报·邮件·商城·排行组合窄屏 manifest 巩固再加深四层 at 1280×720.
 * Soft-deps CLIENT-348～354 wire DOM into these selectors (**非** wave:54 CLIENT-347 主城栈面板集).
 */
export const CLIENT_355_NARROW_MANIFEST_CENTER_PANEL_IDS = CLIENT_339_NARROW_MANIFEST_CENTER_PANEL_IDS;

export type Client355NarrowManifestCenterPanelId = Client339NarrowManifestCenterPanelId;

/** CLIENT-348: minimap scroll-sync residual deepest-deepest-deepest ring on CLIENT-332 deepest-deepest-deeper ring. */
export const MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS =
  "minimap-intel-scroll-sync-residual-deepest-deepest-deepest-ring";

/** CLIENT-348: world tile ETA cross-read residual deepest-deepest-deepest line (CLIENT-332/316 baseline). */
export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS =
  "world-tile-intel-eta-cross-residual-deepest-deepest-deepest-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS =
  "world-tile-intel-eta-cross-residual-deepest-deepest-deepest-pulse";

export const MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_SELECTOR = `.${MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS}`;
export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_SELECTOR = `.${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS}`;
