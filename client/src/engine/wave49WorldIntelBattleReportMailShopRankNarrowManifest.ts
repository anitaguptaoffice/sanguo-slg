import type { AssetLoader } from "@/engine/AssetLoader";
import {
  CLIENT_291_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_291_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_291_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  INTEL_MARCH_PREFILL_RESIDUAL_DEEPER_LINE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_CLASS,
  isWave47WorldIntelBattleReportMailShopRankArtSkinOff,
  panelScrollClearsBottomToolbar,
  PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_DEEPER_ACTION,
  queryClient291PanelRoot,
  type Client291NarrowManifestCenterPanelId,
  WAVE47_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
} from "@/engine/wave47WorldIntelBattleReportMailShopRankNarrowManifest";

/** Bottom toolbar (56px) + focus-ring slack — same as CLIENT-291 / CLIENT-299. */
export const WAVE49_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX = 64;

/**
 * CLIENT-307: wave:49 世界·军情·战报·邮件·商城·排行组合窄屏 manifest 巩固再加深一层 at 1280×720.
 * CLIENT-306 先登记军情 phase / 再出征预填 residual deepest 钩子（软依赖 CLIENT-300～305 并行接线）。
 */
export const CLIENT_307_NARROW_MANIFEST_CENTER_PANEL_IDS = CLIENT_291_NARROW_MANIFEST_CENTER_PANEL_IDS;

export type Client307NarrowManifestCenterPanelId =
  (typeof CLIENT_307_NARROW_MANIFEST_CENTER_PANEL_IDS)[number];

/** CLIENT-306: intel phase change residual deepest pulse (CLIENT-290 baseline). */
export const INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_CLASS =
  "intel-phase-change-residual-deepest-pulse";

/** CLIENT-306: remarch prefill residual deepest readonly summary on military form. */
export const INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_LINE_CLASS =
  "intel-march-prefill-residual-deepest-line";

export const PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_DEEPEST_ACTION =
  "prefill-march-form-from-intel-residual-deepest";

/** Wave:47 baselines that must not regress alongside wave:49 residual deepest hooks. */
export {
  CLIENT_291_PANEL_ASSET_BY_CENTER_ID,
  CLIENT_291_PANEL_SCROLL_ROLE_BY_CENTER_ID,
  INTEL_MARCH_PREFILL_RESIDUAL_DEEPER_LINE_CLASS,
  INTEL_PHASE_CHANGE_RESIDUAL_DEEPER_PULSE_CLASS,
  PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_DEEPER_ACTION,
  WAVE47_WORLD_INTEL_BATTLE_REPORT_MAIL_SHOP_RANK_BOTTOM_TOOLBAR_CLEARANCE_PX,
};

export const INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_SELECTOR = `.march-list li.${INTEL_PHASE_CHANGE_RESIDUAL_DEEPEST_PULSE_CLASS}`;
export const INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_LINE_SELECTOR = `.military-panel .${INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_LINE_CLASS}`;

export { panelScrollClearsBottomToolbar, queryClient291PanelRoot, isWave47WorldIntelBattleReportMailShopRankArtSkinOff };

export const CLIENT_307_PANEL_ASSET_BY_CENTER_ID = CLIENT_291_PANEL_ASSET_BY_CENTER_ID;
export const CLIENT_307_PANEL_SCROLL_ROLE_BY_CENTER_ID = CLIENT_291_PANEL_SCROLL_ROLE_BY_CENTER_ID;

export function queryClient307PanelRoot(
  doc: ParentNode,
  panelId: Client307NarrowManifestCenterPanelId,
): HTMLElement | null {
  return queryClient291PanelRoot(doc, panelId as Client291NarrowManifestCenterPanelId);
}

/** Safe no-op when CLIENT-300～306 sibling DOM is not mounted yet. */
export function pulseWave49ResidualNarrowHook(root: ParentNode, selector: string): void {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) return;
  el.classList.add("wave49-narrow-hook-pulse");
  window.setTimeout(() => el.classList.remove("wave49-narrow-hook-pulse"), 0);
}

export type IntelMarchPrefillResidualDeepest = {
  toX: number;
  toY: number;
  troopsSummary: string;
};

/**
 * CLIENT-306 stub: tolerates missing military form / prefill line until sibling PR lands.
 */
export function prefillMarchFormFromIntelResidualDeepest(
  doc: ParentNode,
  prefill: IntelMarchPrefillResidualDeepest,
): boolean {
  const military = queryClient307PanelRoot(doc, "military");
  if (!military) return false;
  const line =
    military.querySelector<HTMLElement>(`.${INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_LINE_CLASS}`) ??
    military.querySelector<HTMLElement>(
      `[data-action="${PREFILL_MARCH_FORM_FROM_INTEL_RESIDUAL_DEEPEST_ACTION}"]`,
    );
  if (!line) return false;
  line.textContent = `${prefill.toX},${prefill.toY} · ${prefill.troopsSummary}`;
  pulseWave49ResidualNarrowHook(military, INTEL_MARCH_PREFILL_RESIDUAL_DEEPEST_LINE_SELECTOR);
  return true;
}

/** No-op skin hook; nine-slice wired in MainCityScene / panel components. */
export function mountClient307PanelSkins(_root: HTMLElement, _assets: AssetLoader): void {
  if (_root && isWave47WorldIntelBattleReportMailShopRankArtSkinOff(_root)) return;
}
