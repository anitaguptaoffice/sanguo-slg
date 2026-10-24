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
  BAG_SHOP_CATEGORY_SCAN_RING_CLASS,
  COPY_REPORT_COORDS_READONLY_ACTION,
  MAIL_CLAIM_HUD_SYNC_PULSE_CLASS,
  MARCH_FORM_VALIDATION_SWEEP_LINE_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_CLASS,
  MINIMAP_VIEWPORT_ANCHOR_SESSION_KEY,
  MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS,
  RANK_PIN_REFRESH_RESIDUAL_LINE_CLASS,
  RECRUIT_WALLET_COMPARE_RESIDUAL_LINE_CLASS,
  REPORT_LIST_DENSITY_ROW_CLASS,
  REPORT_LIST_KEYBOARD_FOCUS_RING_CLASS,
  WORLD_TILE_INTEL_ETA_RESIDUAL_RING_CLASS,
} from "@/engine/wave41WorldIntelBattleReportMailShopRankRecruitNarrowManifest";

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-243 / CLIENT-251. */
export const WAVE43_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-259: wave:43 世界·军情·战报·邮件·商城·排行·招募组合窄屏 manifest at 1280×720.
 * Soft-deps CLIENT-252～258 wire DOM into these selectors (**非** wave:42 主城将领日常社交队列 manifest 面板集).
 */
export const CLIENT_259_NARROW_MANIFEST_CENTER_PANEL_IDS = [
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

export type Client259NarrowManifestCenterPanelId =
  (typeof CLIENT_259_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

/** CLIENT-252: minimap viewport scroll-sync deep ring (CLIENT-236/220 baseline). */
export const MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS = "minimap-intel-scroll-sync-deep-ring";

/** CLIENT-252: world tile ETA cross-read residual line beside CLIENT-237 ring. */
export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_LINE_CLASS =
  "world-tile-intel-eta-cross-residual-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS =
  "world-tile-intel-eta-cross-residual-pulse";

/** CLIENT-253: march form troop margin + wallet readonly residual subline. */
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_CLASS = "march-form-troop-margin-residual-line";

/** CLIENT-253: extends CLIENT-238 refresh stamp display on successful MarchAttack. */
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_CLASS = "march-submit-intel-refresh-stamp-deep";

/** CLIENT-269: residual deep refresh stamp on CLIENT-253 deep stamp (3s). */
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_RESIDUAL_DEEP_CLASS =
  "march-submit-intel-refresh-stamp-residual-deep";

/** CLIENT-269: march form troop margin residual deep third line. */
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_DEEP_LINE_CLASS =
  "march-form-troop-margin-residual-deep-line";

export const INTEL_LIST_REFRESH_MARCH_DEEP_PULSE_CLASS = "intel-list-refresh-march-deep-pulse";

/** CLIENT-254: adjacent report list keyboard nav residual ring. */
export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_CLASS =
  "report-list-keyboard-adjacent-nav-residual-ring";

/** CLIENT-254: coord copy bar selection sweep (CLIENT-240 baseline). */
export const BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_CLASS =
  "battle-report-coord-copy-bar-residual-sweep";

/** CLIENT-255: mail claim → HUD badge deep pulse after CLIENT-241 sync. */
export const MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS = "mail-claim-hud-sync-deep-pulse";

export const MAIL_ATTACHMENT_CLAIM_RESIDUAL_SUBLINE_CLASS = "mail-attachment-claim-residual-subline";

/** CLIENT-256: bag/shop row inline affordance residual ring. */
export const BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS = "bag-shop-inline-state-residual-ring";

export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_CLASS = "panel-return-source-highlight-residual";

/** CLIENT-272: bag/shop inline state residual deep ring + panel return source deep highlight. */
export const BAG_SHOP_INLINE_STATE_RESIDUAL_DEEP_RING_CLASS =
  "bag-shop-inline-state-residual-deep-ring";

export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_CLASS =
  "panel-return-source-highlight-residual-deep";

/** CLIENT-257: rank list density scan residual line. */
export const RANK_LIST_DENSITY_SCAN_RESIDUAL_LINE_CLASS = "rank-list-density-scan-residual-line";

/** CLIENT-257: recruit template inline summary residual line. */
export const RECRUIT_TEMPLATE_INLINE_RESIDUAL_SUMMARY_CLASS = "recruit-template-inline-residual-summary";

/** CLIENT-258: intel phase change residual pulse (CLIENT-205/221 baseline). */
export const INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS = "intel-phase-change-residual-pulse";

/** CLIENT-258: remarch prefill readonly summary on military form. */
export const INTEL_MARCH_PREFILL_RESIDUAL_LINE_CLASS = "intel-march-prefill-residual-line";

export const PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_ACTION = "prefill-march-form-from-intel-residual";

/** Wave:41 baselines that must not regress alongside wave:43 residuals. */
export {
  BAG_SHOP_CATEGORY_SCAN_RING_CLASS,
  COPY_REPORT_COORDS_READONLY_ACTION,
  MAIL_CLAIM_HUD_SYNC_PULSE_CLASS,
  MARCH_FORM_VALIDATION_SWEEP_LINE_CLASS,
  MARCH_SUBMIT_INTEL_REFRESH_STAMP_CLASS,
  MINIMAP_VIEWPORT_ANCHOR_SESSION_KEY,
  MINIMAP_VIEWPORT_INTEL_SYNC_RING_CLASS,
  RANK_PIN_REFRESH_RESIDUAL_LINE_CLASS,
  RECRUIT_WALLET_COMPARE_RESIDUAL_LINE_CLASS,
  REPORT_LIST_DENSITY_ROW_CLASS,
  REPORT_LIST_KEYBOARD_FOCUS_RING_CLASS,
  WORLD_TILE_INTEL_ETA_RESIDUAL_RING_CLASS,
};

export const MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_SELECTOR = `.${MINIMAP_INTEL_SCROLL_SYNC_DEEP_RING_CLASS}`;
export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_LINE_SELECTOR = `.${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_LINE_CLASS}`;
export const MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_SELECTOR = `.military-panel .${MARCH_FORM_TROOP_MARGIN_RESIDUAL_LINE_CLASS}`;
export const MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_SELECTOR = `.military-panel .${MARCH_SUBMIT_INTEL_REFRESH_STAMP_DEEP_CLASS}`;
export const REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_SELECTOR = `.battle-report-list li.${REPORT_LIST_KEYBOARD_ADJACENT_NAV_RESIDUAL_RING_CLASS}`;
export const BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_SELECTOR = `.${BATTLE_REPORT_COORD_COPY_BAR_RESIDUAL_SWEEP_CLASS}`;
export const MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_SELECTOR = `.mail-list li .${MAIL_CLAIM_HUD_SYNC_DEEP_PULSE_CLASS}`;
export const MAIL_ATTACHMENT_CLAIM_RESIDUAL_SUBLINE_SELECTOR = `.mail-list li .${MAIL_ATTACHMENT_CLAIM_RESIDUAL_SUBLINE_CLASS}`;
export const BAG_SHOP_INLINE_STATE_RESIDUAL_RING_SELECTOR = `.bag-list li.${BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS}, .shop-offer-list li.${BAG_SHOP_INLINE_STATE_RESIDUAL_RING_CLASS}`;
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_SELECTOR = `.${PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_CLASS}`;
export const RANK_LIST_DENSITY_SCAN_RESIDUAL_LINE_SELECTOR = `.${RANK_LIST_DENSITY_SCAN_RESIDUAL_LINE_CLASS}`;
export const RECRUIT_TEMPLATE_INLINE_RESIDUAL_SUMMARY_SELECTOR = `.${RECRUIT_TEMPLATE_INLINE_RESIDUAL_SUMMARY_CLASS}`;
export const INTEL_PHASE_CHANGE_RESIDUAL_PULSE_SELECTOR = `.march-list li.${INTEL_PHASE_CHANGE_RESIDUAL_PULSE_CLASS}`;
export const INTEL_MARCH_PREFILL_RESIDUAL_LINE_SELECTOR = `.military-panel .${INTEL_MARCH_PREFILL_RESIDUAL_LINE_CLASS}`;

export const CLIENT_259_PANEL_ASSET_BY_CENTER_ID: Record<
  Client259NarrowManifestCenterPanelId,
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

export const CLIENT_259_PANEL_SCROLL_ROLE_BY_CENTER_ID: Record<
  Client259NarrowManifestCenterPanelId,
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

export function isWave43WorldIntelBattleReportMailShopRankArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

export function queryClient259PanelRoot(
  doc: ParentNode,
  panelId: Client259NarrowManifestCenterPanelId,
): HTMLElement | null {
  if (doc instanceof HTMLElement && doc.dataset.centerPanel === panelId) {
    return doc;
  }
  if (panelId === "military") {
    return doc.querySelector<HTMLElement>(`.military-panel[data-center-panel="military"]`);
  }
  return doc.querySelector<HTMLElement>(`[data-center-panel="${panelId}"]`);
}

/** Safe no-op when CLIENT-252～258 sibling DOM is not mounted yet. */
export function pulseWave43ResidualNarrowHook(root: ParentNode, selector: string): void {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) return;
  el.classList.add("wave43-narrow-hook-pulse");
  window.setTimeout(() => el.classList.remove("wave43-narrow-hook-pulse"), 0);
}

export type IntelMarchPrefillResidual = {
  toX: number;
  toY: number;
  troopsSummary: string;
};

/**
 * CLIENT-258 stub: tolerates missing military form / prefill line until sibling PR lands.
 */
export function prefillMarchFormFromIntelResidual(
  doc: ParentNode,
  prefill: IntelMarchPrefillResidual,
): boolean {
  const military = queryClient259PanelRoot(doc, "military");
  if (!military) return false;
  const line =
    military.querySelector<HTMLElement>(`.${INTEL_MARCH_PREFILL_RESIDUAL_LINE_CLASS}`) ??
    military.querySelector<HTMLElement>(
      `[data-action="${PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_ACTION}"]`,
    );
  if (!line) return false;
  line.textContent = `${prefill.toX},${prefill.toY} · ${prefill.troopsSummary}`;
  pulseWave43ResidualNarrowHook(military, INTEL_MARCH_PREFILL_RESIDUAL_LINE_SELECTOR);
  return true;
}

/** No-op skin hook; nine-slice wired in MainCityScene / panel components. */
export function mountClient259PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isWave43WorldIntelBattleReportMailShopRankArtSkinOff(_root)) return;
}
