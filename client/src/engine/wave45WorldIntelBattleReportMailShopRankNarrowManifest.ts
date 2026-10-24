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
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_CLASS,
  BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_CLASS,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_CLASS,
  CLIENT_259_NARROW_MANIFEST_CENTER_PANEL_IDS,
  INTEL_MARCH_PREFILL_RESIDUAL_LINE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS,
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_SUBLINE_CLASS,
  MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEP_LINE_CLASS,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_CLASS,
  MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS,
  MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_CLASS,
  PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_ACTION,
  RANK_LIST_DENSITY_SCAN_RESIDUAL_LINE_CLASS,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_SUMMARY_CLASS,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEP_RING_CLASS,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_LINE_CLASS,
} from "@/engine/wave43WorldIntelBattleReportMailShopRankNarrowManifest";
import {
  BAG_SHOP_CATEGORY_SCAN_RING_CLASS,
  COPY_REPORT_COORDS_READONLY_ACTION,
  MAIL_CLAIM_HUD_SYNC_PULSE_CLASS,
  MARCH_FORM_VALIDATION_SWEEP_LINE_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_CLASS,
  MINIMAP_VIEWPORT_ANCHOR_SESSION_KEY,
  REPORT_LIST_DENSITY_ROW_CLASS,
  REPORT_LIST_KEYBOARD_FOCUS_RING_CLASS,
  WORLD_TILE_INTEL_ETA_RESIDUAL_RING_CLASS,
} from "@/engine/wave41WorldIntelBattleReportMailShopRankRecruitNarrowManifest";

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-259 / CLIENT-267. */
export const WAVE45_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-275: wave:45 世界·军情·战报·邮件·商城·排行组合窄屏 manifest 巩固 at 1280×720.
 * Soft-deps CLIENT-268～274 wire DOM into these selectors (**非** wave:44 CLIENT-267 主城栈面板集).
 */
export const CLIENT_275_NARROW_MANIFEST_CENTER_PANEL_IDS = CLIENT_259_NARROW_MANIFEST_CENTER_PANEL_IDS;

export type Client275NarrowManifestCenterPanelId =
  (typeof CLIENT_275_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

/** CLIENT-268: minimap scroll-sync residual deep ring on CLIENT-252 deep ring. */
export const MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_CLASS =
  "minimap-intel-scroll-sync-residual-deep-ring";

/** CLIENT-268: world tile ETA cross-read residual deep line (CLIENT-252 baseline). */
export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_LINE_CLASS =
  "world-tile-intel-eta-cross-residual-deep-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_CLASS =
  "world-tile-intel-eta-cross-residual-deep-pulse";

export const INTEL_LIST_REFRESH_MARCH_RESIDUAL_DEEP_PULSE_CLASS =
  "intel-list-refresh-march-residual-deep-pulse";

/** CLIENT-271: mail claim → HUD badge residual deep pulse after CLIENT-255 sync. */
export const MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_CLASS =
  "mail-claim-hud-sync-residual-deep-pulse";

export const MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEP_SUBLINE_CLASS =
  "mail-attachment-claim-residual-deep-subline";

/** CLIENT-273: rank list density scan residual deep line. */
export const RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEP_LINE_CLASS =
  "rank-list-density-scan-residual-deep-line";

/** CLIENT-273: recruit template inline summary residual deep line. */
export const RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEP_SUMMARY_CLASS =
  "recruit-template-inline-residual-deep-summary";

/** CLIENT-274: intel phase change residual deep pulse (CLIENT-258 baseline). */
export const INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS =
  "intel-phase-change-residual-deep-pulse";

/** CLIENT-274: remarch prefill residual deep readonly summary on military form. */
export const INTEL_MARCH_PREFILL_RESIDUAL_DEEP_LINE_CLASS =
  "intel-march-prefill-residual-deep-line";

export const PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_DEEP_ACTION =
  "prefill-march-form-from-intel-residual-deep";

/** Wave:43 / wave:41 baselines that must not regress alongside wave:45 residual deep hooks. */
export {
  BAG_SHOP_CATEGORY_SCAN_RING_CLASS,
  BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_CLASS,
  BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_CLASS,
  BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_CLASS,
  COPY_REPORT_COORDS_READONLY_ACTION,
  INTEL_MARCH_PREFILL_RESIDUAL_LINE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS,
  MAIL_ATTACHMENT_CLAIM_RESIDUAL_SUBLINE_CLASS,
  MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS,
  MAIL_CLAIM_HUD_SYNC_PULSE_CLASS,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEP_LINE_CLASS,
  MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_CLASS,
  MARCH_FORM_VALIDATION_SWEEP_LINE_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_CLASS,
  MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS,
  MINIMAP_VIEWPORT_ANCHOR_SESSION_KEY,
  MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_CLASS,
  PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_ACTION,
  RANK_LIST_DENSITY_SCAN_RESIDUAL_LINE_CLASS,
  RECRUIT_TEMPLATE_INLINE_RESIDUAL_SUMMARY_CLASS,
  REPORT_LIST_DENSITY_ROW_CLASS,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEP_RING_CLASS,
  REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_CLASS,
  REPORT_LIST_KEYBOARD_FOCUS_RING_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_LINE_CLASS,
  WORLD_TILE_INTEL_ETA_RESIDUAL_RING_CLASS,
};

export const MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_SELECTOR = `.${MINIMAP_INTEL_SCROLL_SYNC_RESIDUAL_DEEP_RING_CLASS}`;
export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_LINE_SELECTOR = `.${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_LINE_CLASS}`;
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEP_LINE_SELECTOR = `.military-panel .${MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEP_LINE_CLASS}`;
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_SELECTOR = `.military-panel .${MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_CLASS}`;
export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEP_RING_SELECTOR = `.battle-report-list li.${REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_DEEP_RING_CLASS}`;
export const BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_SELECTOR = `.${BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_DEEP_SWEEP_CLASS}`;
export const MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_SELECTOR = `.mail-list li .${MAIL_CLAIM_HUD_SYNC_RESIDUAL_DEEP_PULSE_CLASS}`;
export const MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEP_SUBLINE_SELECTOR = `.mail-list li .${MAIL_ATTACHMENT_CLAIM_RESIDUAL_DEEP_SUBLINE_CLASS}`;
export const BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_SELECTOR = `.bag-list li.${BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_CLASS}, .shop-offer-list li.${BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_CLASS}`;
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_SELECTOR = `.${PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_CLASS}`;
export const RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEP_LINE_SELECTOR = `.${RANK_LIST_DENSITY_SCAN_RESIDUAL_DEEP_LINE_CLASS}`;
export const RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEP_SUMMARY_SELECTOR = `.${RECRUIT_TEMPLATE_INLINE_RESIDUAL_DEEP_SUMMARY_CLASS}`;
export const INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_SELECTOR = `.march-list li.${INTEL_PHASE_CHANGE_RESIDUAL_DEEP_PULSE_CLASS}`;
export const INTEL_MARCH_PREFILL_RESIDUAL_DEEP_LINE_SELECTOR = `.military-panel .${INTEL_MARCH_PREFILL_RESIDUAL_DEEP_LINE_CLASS}`;

export const CLIENT_275_PANEL_ASSET_BY_CENTER_ID: Record<
  Client275NarrowManifestCenterPanelId,
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

export const CLIENT_275_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client275NarrowManifestCenterPanelId,
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

export function isWave45WorldIntelBattleReportMailShopRankArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryClient275PanelRoot(
  doc: ParentNode,
  panelId: Client275NarrowManifestCenterPanelId,
): HTMLElement | null {
  if (doc instanceof HTMLElement && doc.dataset.centerPanel === panelId) {
    return doc;
  }
  if (panelId === "military") {
    return doc.querySelector<HTMLElement>(`.military-panel[data-center-panel="military"]`);
  }
  return doc.querySelector<HTMLElement>(`[data-center-panel="${panelId}"]`);
}

/** Safe no-op when CLIENT-268～274 sibling DOM is not mounted yet. */
export function pulseWave45ResidualNarrowHook(root: ParentNode, selector: string): void {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) return;
  el.classList.add("wave45-narrow-hook-pulse");
  window.setTimeout(() => el.classList.remove("wave45-narrow-hook-pulse"), 0);
}

export type IntelMarchPrefillResidualDeep = {
  toX: number;
  toY: number;
  troopsSummary: string;
};

/**
 * CLIENT-274 stub: tolerates missing military form / prefill line until sibling PR lands.
 */
export function prefillMarchFormFromIntelResidualDeep(
  doc: ParentNode,
  prefill: IntelMarchPrefillResidualDeep,
): boolean {
  const military = queryClient275PanelRoot(doc, "military");
  if (!military) return false;
  const line =
    military.querySelector<HTMLElement>(`.${INTEL_MARCH_PREFILL_RESIDUAL_DEEP_LINE_CLASS}`) ??
    military.querySelector<HTMLElement>(
      `[data-action="${PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_DEEP_ACTION}"]`,
    );
  if (!line) return false;
  line.textContent = `${prefill.toX},${prefill.toY} · ${prefill.troopsSummary}`;
  pulseWave45ResidualNarrowHook(military, INTEL_MARCH_PREFILL_RESIDUAL_DEEP_LINE_SELECTOR);
  return true;
}

/** No-op skin hook; nine-slice wired in MainCityScene / panel components. */
export function mountClient275PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isWave45WorldIntelBattleReportMailShopRankArtSkinOff(_root)) return;
}
