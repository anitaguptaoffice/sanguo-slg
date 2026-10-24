import type { AssetLoader } from "@/engine/AssetLoader";
import {
  PANEL_ASSET_BAG,
  PANEL_ASSET_BATTLE_REPORT,
  PANEL_ASSET_DEFAULT,
  PANEL_ASSET_HERO,
  PANEL_ASSET_MARCH,
  PANEL_ASSET_MILITARY,
  PANEL_ASSET_RANK,
  PANEL_ASSET_SHOP,
  PANEL_ASSET_WORLD,
} from "@/engine/artPanelSkin";
import { TOOLBAR_HEIGHT } from "@/engine/mainCitySlots";
import {
  INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_CLASS,
  MINIMAP_INTEL_SYNC_RING_CLASS,
} from "@/engine/wave39MinimapIntelSyncNarrowManifest";
import {
  HUD_MILITARY_TODO_PULSE_CLASS,
  HUD_MILITARY_TODO_SWEEP_CLASS,
  HUD_MILITARY_TODO_SWEEP_LINE_ROLE,
  INTEL_NEW_MARCH_HIGHLIGHT_CLASS,
  INTEL_PHASE_CHANGE_FLASH_CLASS,
  MAIL_BATTLE_CATEGORY_SWEEP_LINE_CLASS,
  MARCH_SUBMIT_INTEL_HANDOFF_LINE_CLASS,
  OPEN_INTEL_FOR_REPORT_ACTION,
  REPORT_LIST_INTEL_JUMP_TAG_CLASS,
  REPORT_OUTCOME_FILTER_BRIDGE_SESSION_KEY,
  REPORT_ROUND_SUMMARY_INTEL_LINK_CLASS,
} from "@/engine/wave39WorldIntelBattleReportMailMarchHudNarrowManifest";
import {
  MINIMAP_VIEWPORT_INTEL_ANCHOR_SESSION_KEY,
  MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS,
} from "@/net/minimapViewportIntelSync";
import {
  MARCH_FORM_VALIDATION_SWEEP_CLASS as MARCH_FORM_VALIDATION_SWEEP_LINE_CLASS,
} from "@/net/marchFormValidationSweep";
import { MARCH_SUBMIT_INTEL_REFRESH_STAMP_CLASS } from "@/net/marchSubmitIntelRefreshStamp";
import {
  REPORT_LIST_DENSITY_ROW_CLASS,
  REPORT_LIST_KEYBOARD_FOCUS_RING_CLASS,
} from "@/net/battleReportListDensityKeyboard";
import {
  BATTLE_REPORT_SIDE_TEMPLATE_RESIDUAL_LINE_CLASS,
  COPY_REPORT_COORDS_READONLY_ACTION,
} from "@/net/battleReportDetailTemplateResidual";
import { BAG_SHOP_CATEGORY_SCAN_RING_CLASS } from "@/net/bagShopCategoryScan";
import { MAIL_CLAIM_HUD_SYNC_PULSE_CLASS } from "@/net/mailClaimHudBadgeSync";
import { RANK_PIN_REFRESH_RESIDUAL_CLASS } from "@/net/rankPinRefreshResidual";
import { RECRUIT_WALLET_COMPARE_RESIDUAL_CLASS } from "@/net/recruitWalletCompareResidual";
import {
  WORLD_TILE_INTEL_ETA_RESIDUAL_LINE_CLASS,
  WORLD_TILE_INTEL_ETA_RESIDUAL_RING_CLASS,
} from "@/ui/worldTileIntelEtaResidual";

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-227 / CLIENT-235. */
export const WAVE41_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_RECRUIT_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-243: wave:41 世界·军情·战报·邮件·商城·排行·招募组合窄屏 manifest at 1280×720.
 * Soft-deps CLIENT-236～242 wire DOM into these selectors.
 */
export const CLIENT_243_NARROW_MANIFEST_CENTER_PANEL_IDS = [
  "world",
  "march",
  "military",
  "battle-report",
  "mail",
  "bag",
  "shop",
  "rank",
  "hero",
] as const;

export type Client243NarrowManifestCenterPanelId =
  (typeof CLIENT_243_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

/** CLIENT-236: minimap viewport anchor ↔ intel row scroll-sync ring (extends CLIENT-220). */
export {
  MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS,
  MINIMAP_VIEWPORT_INTEL_ANCHOR_SESSION_KEY as MINIMAP_VIEWPORT_ANCHOR_SESSION_KEY,
};

/** CLIENT-237: world tile intel ETA residual line ↔ march intel card mutual ring. */
export { WORLD_TILE_INTEL_ETA_RESIDUAL_LINE_CLASS, WORLD_TILE_INTEL_ETA_RESIDUAL_RING_CLASS };

/** CLIENT-238: march form validation sweep + post-submit intel refresh stamp. */
export { MARCH_FORM_VALIDATION_SWEEP_LINE_CLASS, MARCH_SUBMIT_INTEL_REFRESH_STAMP_CLASS };

/** CLIENT-239: battle report list density row + j/k keyboard focus ring. */
export { REPORT_LIST_DENSITY_ROW_CLASS, REPORT_LIST_KEYBOARD_FOCUS_RING_CLASS };

/** CLIENT-240: detail side template residual line + readonly coord copy bar. */
export { BATTLE_REPORT_SIDE_TEMPLATE_RESIDUAL_LINE_CLASS, COPY_REPORT_COORDS_READONLY_ACTION };

/** CLIENT-241: mail claim success → HUD mail/quest badge sync pulse. */
export { MAIL_CLAIM_HUD_SYNC_PULSE_CLASS };

/** CLIENT-242: bag/shop category scan ring + rank pin / recruit wallet residual compare lines. */
export { BAG_SHOP_CATEGORY_SCAN_RING_CLASS };
export const RANK_PIN_REFRESH_RESIDUAL_LINE_CLASS = RANK_PIN_REFRESH_RESIDUAL_CLASS;
export const RECRUIT_WALLET_COMPARE_RESIDUAL_LINE_CLASS = RECRUIT_WALLET_COMPARE_RESIDUAL_CLASS;

export {
  HUD_MILITARY_TODO_PULSE_CLASS,
  HUD_MILITARY_TODO_SWEEP_CLASS,
  HUD_MILITARY_TODO_SWEEP_LINE_ROLE,
  INTEL_NEW_MARCH_HIGHLIGHT_CLASS,
  INTEL_PHASE_CHANGE_FLASH_CLASS,
  INTEL_ROW_MINIMAP_SYNC_HIGHLIGHT_CLASS,
  MAIL_BATTLE_CATEGORY_SWEEP_LINE_CLASS,
  MARCH_SUBMIT_INTEL_HANDOFF_LINE_CLASS,
  MINIMAP_INTEL_SYNC_RING_CLASS,
  OPEN_INTEL_FOR_REPORT_ACTION,
  REPORT_LIST_INTEL_JUMP_TAG_CLASS,
  REPORT_OUTCOME_FILTER_BRIDGE_SESSION_KEY,
  REPORT_ROUND_SUMMARY_INTEL_LINK_CLASS,
};

export const MINIMAP_VIEWPORT_INTEL_SYNC_RING_SELECTOR = `.${MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS}`;
export const WORLD_TILE_INTEL_ETA_RESIDUAL_RING_SELECTOR = `.${WORLD_TILE_INTEL_ETA_RESIDUAL_RING_CLASS}`;
export const MARCH_FORM_VALIDATION_SWEEP_LINE_SELECTOR = `.${MARCH_FORM_VALIDATION_SWEEP_LINE_CLASS}`;
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_SELECTOR = `.${MARCH_SUBMIT_INTEL_REFRESH_STAMP_CLASS}`;
export const REPORT_LIST_DENSITY_ROW_SELECTOR = `.battle-report-list li.${REPORT_LIST_DENSITY_ROW_CLASS}`;
export const REPORT_LIST_KEYBOARD_FOCUS_RING_SELECTOR = `.battle-report-list li.${REPORT_LIST_KEYBOARD_FOCUS_RING_CLASS}`;
export const BATTLE_REPORT_SIDE_TEMPLATE_RESIDUAL_LINE_SELECTOR = `.${BATTLE_REPORT_SIDE_TEMPLATE_RESIDUAL_LINE_CLASS}`;
export const COPY_REPORT_COORDS_READONLY_SELECTOR = `[data-action="${COPY_REPORT_COORDS_READONLY_ACTION}"]`;
export const MAIL_CLAIM_HUD_SYNC_PULSE_SELECTOR = `.mail-list li .${MAIL_CLAIM_HUD_SYNC_PULSE_CLASS}`;
export const BAG_SHOP_CATEGORY_SCAN_RING_SELECTOR = `.bag-list li.${BAG_SHOP_CATEGORY_SCAN_RING_CLASS}, .shop-offer-list li.${BAG_SHOP_CATEGORY_SCAN_RING_CLASS}`;
export const RANK_PIN_REFRESH_RESIDUAL_LINE_SELECTOR = `.${RANK_PIN_REFRESH_RESIDUAL_LINE_CLASS}`;
export const RECRUIT_WALLET_COMPARE_RESIDUAL_LINE_SELECTOR = `.${RECRUIT_WALLET_COMPARE_RESIDUAL_LINE_CLASS}`;

export const CLIENT_243_PANEL_ASSET_BY_CENTER_ID: Record<
  Client243NarrowManifestCenterPanelId,
  string
> = {
  world: PANEL_ASSET_WORLD,
  march: PANEL_ASSET_MARCH,
  military: PANEL_ASSET_MILITARY,
  "battle-report": PANEL_ASSET_BATTLE_REPORT,
  mail: PANEL_ASSET_DEFAULT,
  bag: PANEL_ASSET_BAG,
  shop: PANEL_ASSET_SHOP,
  rank: PANEL_ASSET_RANK,
  hero: PANEL_ASSET_HERO,
};

export const CLIENT_243_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client243NarrowManifestCenterPanelId,
  string
> = {
  world: "world-scroll",
  march: "march-scroll",
  military: "military-scroll",
  "battle-report": "battle-report-scroll",
  mail: "mail-scroll",
  bag: "bag-scroll",
  shop: "shop-scroll",
  rank: "rank-scroll",
  hero: "hero-scroll",
};

export function panelScrollClearsBottomToolbar(paddingBottomPx: number): boolean {
  return paddingBottomPx >= TOOLBAR_HEIGHT;
}

export function isWave41WorldIntelBattleReportMailShopRankRecruitArtSkinOff(
  el: HTMLElement,
): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryClient243PanelRoot(
  doc: ParentNode,
  panelId: Client243NarrowManifestCenterPanelId,
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
export function mountClient243PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isWave41WorldIntelBattleReportMailShopRankRecruitArtSkinOff(_root)) return;
}
