import type { AssetLoader } from "@/engine/AssetLoader";
import {
  CLIENT_339_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_339_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_339_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  isWave53WorldIntelBattleReportMailShopRankArtSkinOff,
  mountClient339PanelSkins,
  panelScrollClearsBottomToolbar,
  pulseWave53ResidualNarrowHook,
  queryClient339PanelRoot,
  type Client339NarrowManifestCenterPanelId,
} from "@/engine/wave53WorldIntelBattleReportMailShopRankNarrowManifest";
export { panelScrollClearsBottomToolbar };
import {
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
  INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS,
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS,
  MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_CLASS,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPER_CLASS,
  PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_DEEPEST_DEEPER_ACTION,
  RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_CLASS,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUMMARY_CLASS,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPER_SUMMARY_CLASS,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
} from "@/engine/wave53WorldIntelBattleReportMailShopRankNarrowManifest";
import { TOOLBAR_HEIGHT } from "@/engine/mainCitySlots";

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-339 / CLIENT-347. */
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

/** CLIENT-348: world tile ETA cross-read residual deepest-deepest-deepest line (CLIENT-300/316/332 baseline). */
export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS =
  "world-tile-intel-eta-cross-residual-deepest-deepest-deepest-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS =
  "world-tile-intel-eta-cross-residual-deepest-deepest-deepest-pulse";

/** CLIENT-349: march form troop margin residual deepest-deepest-deepest read-only line. */
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS =
  "march-form-troop-margin-residual-deepest-deepest-deepest-line";

/** CLIENT-349: post-MarchAttack intel refresh stamp residual deepest-deepest-deepest (3s). */
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_CLASS =
  "march-submit-intel-refresh-stamp-residual-deepest-deepest-deepest";

/** CLIENT-350: battle report keyboard adjacent nav residual deepest-deepest-deepest ring. */
export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS =
  "report-list-keyboard-adjacent-nav-residual-deepest-deepest-deepest-ring";

/** CLIENT-350: coord copy bar residual deepest-deepest-deepest sweep. */
export const BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS =
  "battle-report-coord-copy-bar-residual-deepest-deepest-deepest-sweep";

/** CLIENT-351: mail claim → HUD badge residual deepest-deepest-deepest pulse after CLIENT-335 sync. */
export const MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS =
  "mail-claim-hud-sync-residual-deepest-deepest-deepest-pulse";

export const MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_CLASS =
  "mail-attachment-claim-residual-deepest-deepest-deepest-subline";

/** CLIENT-352: bag/shop inline state residual deepest-deepest-deepest ring. */
export const BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS =
  "bag-shop-inline-state-residual-deepest-deepest-deepest-ring";

/** CLIENT-352: panel return source highlight residual deepest-deepest-deepest. */
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_CLASS =
  "panel-return-source-highlight-residual-deepest-deepest-deepest";

/** CLIENT-353: rank list density scan residual deepest-deepest-deepest line. */
export const RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS =
  "rank-list-density-scan-residual-deepest-deepest-deepest-line";

/** CLIENT-353: recruit template inline summary residual deepest-deepest-deepest line. */
export const RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUMMARY_CLASS =
  "recruit-template-inline-residual-deepest-deepest-deepest-summary";

/** CLIENT-354: intel phase change residual deepest-deepest-deepest pulse (CLIENT-322 baseline). */
export const INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS =
  "intel-phase-change-residual-deepest-deepest-deepest-pulse";

/** CLIENT-354: remarch prefill residual deepest-deepest-deepest readonly summary on military form. */
export const INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS =
  "intel-march-prefill-residual-deepest-deepest-deepest-line";

export const PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_ACTION =
  "prefill-march-form-from-intel-residual-deepest-deepest-deepest";

/** Wave:53 baselines that must not regress alongside wave:55 residual deepest-deepest-deepest hooks. */
export {
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SWEEP_CLASS,
  INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_CLASS,
  INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS,
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUBLINE_CLASS,
  MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_CLASS,
  MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPER_CLASS,
  PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_DEEPEST_DEEPER_ACTION,
  RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_CLASS,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPER_SUMMARY_CLASS,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
};

export {
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
  PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_DEEPEST_DEEPEST_DEEPER_ACTION,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPER_SUMMARY_CLASS,
} from "@/engine/wave53WorldIntelBattleReportMailShopRankNarrowManifest";

export const MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_SELECTOR = `.${MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS}`;
export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_SELECTOR = `.${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS}`;
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_SELECTOR = `.military-panel .${MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS}`;
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SELECTOR = `.military-panel .${MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_CLASS}`;
export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_SELECTOR = `.battle-report-list li.${REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS}`;
export const BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_SELECTOR = `.${BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SWEEP_CLASS}`;
export const MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_SELECTOR = `.mail-list li .${MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS}`;
export const MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_SELECTOR = `.mail-list li .${MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUBLINE_CLASS}`;
export const BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_SELECTOR = `.bag-list li.${BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS}, .shop-offer-list li.${BAG_SHOP_INLINE_STATE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_RING_CLASS}`;
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SELECTOR = `.${PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_CLASS}`;
export const RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_SELECTOR = `.${RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS}`;
export const RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUMMARY_SELECTOR = `.${RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_SUMMARY_CLASS}`;
export const INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_SELECTOR = `.march-list li.${INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS}`;
export const INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_SELECTOR = `.military-panel .${INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS}`;

export const CLIENT_355_PANEL_ASSET_BY_CENTER_ID = CLIENT_339_PANEL_ASSET_BY_CENTER_ID;

export const CLIENT_355_PANEL_SCROLL_ROLE_BY_CENTER_ID = CLIENT_339_PANEL_SCROLL_ROLE_BY_CENTER_ID;

export function wave55PanelScrollClearsBottomToolbar(paddingBottomPx: number): boolean {
  return panelScrollClearsBottomToolbar(paddingBottomPx) && paddingBottomPx >= TOOLBAR_HEIGHT;
}

export function isWave55WorldIntelBattleReportMailShopRankArtSkinOff(el: HTMLElement): boolean {
  return isWave53WorldIntelBattleReportMailShopRankArtSkinOff(el);
}

export function queryClient355PanelRoot(
  doc: ParentNode,
  panelId: Client355NarrowManifestCenterPanelId,
): HTMLElement | null {
  return queryClient339PanelRoot(doc, panelId);
}

/** Safe no-op when CLIENT-348～354 sibling DOM is not mounted yet. */
export function pulseWave55ResidualNarrowHook(root: ParentNode, selector: string): void {
  pulseWave53ResidualNarrowHook(root, selector);
}

export type IntelMarchPrefillResidualDeepestDeepestDeepest = {
  toX: number;
  toY: number;
  troopsSummary: string;
};

/**
 * CLIENT-354 stub: tolerates missing military form / prefill line until sibling PR lands.
 */
export function prefillMarchFormFromIntelResidualDeepestDeepestDeepest(
  doc: ParentNode,
  prefill: IntelMarchPrefillResidualDeepestDeepestDeepest,
): boolean {
  const military = queryClient355PanelRoot(doc, "military");
  if (!military) return false;
  const line =
    military.querySelector<HTMLElement>(
      `.${INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS}`,
    ) ??
    military.querySelector<HTMLElement>(
      `[data-action="${PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_ACTION}"]`,
    );
  if (!line) return false;
  line.textContent = `${prefill.toX},${prefill.toY} · ${prefill.troopsSummary}`;
  pulseWave55ResidualNarrowHook(
    military,
    INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_SELECTOR,
  );
  return true;
}

/** No-op skin hook until CLIENT-355 consolidates panel skins. */
export function mountClient355PanelSkins(root: HTMLElement, assets: AssetLoader): void {
  mountClient339PanelSkins(root, assets);
}
