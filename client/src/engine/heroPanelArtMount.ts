import type { AssetLoader } from "@/engine/AssetLoader";
import { PANEL_ASSET_HERO, skinHeroPanel } from "@/engine/artPanelSkin";
import { applyPanelStateChrome, type PanelStateKind } from "@/engine/panelStateChrome";

/** Manifest id stamped on hero center panel root (`data-art-panel`). */
export const HERO_PANEL_SHELL_ASSET_ID = PANEL_ASSET_HERO;

export const HERO_PANEL_ART_PANEL_ATTR = "data-art-panel";
export const HERO_PANEL_ART_PLACEHOLDER_ATTR = "data-art-panel-placeholder";

export const HERO_PANEL_SHELL_PLACEHOLDER_CLASS = "hero-panel-shell-placeholder";

export type HeroPanelArtMountMode = "skinned" | "placeholder";

export type HeroPanelArtMountPlan = {
  assetId: string;
  mode: HeroPanelArtMountMode;
};

export function isHeroPanelArtSkinOff(root: HTMLElement): boolean {
  return root.dataset.artSkin === "off" || root.closest("[data-art-skin='off']") != null;
}

export function heroPanelShellManifestReady(assets: AssetLoader): boolean {
  const pack = assets.getImageForAsset(HERO_PANEL_SHELL_ASSET_ID);
  const meta = assets.getArtMeta(HERO_PANEL_SHELL_ASSET_ID);
  return !!(pack && meta?.nine_slice);
}

/** CLIENT-230: decide hero shell nine-slice vs placeholder (no spend / no new RPC). */
export function resolveHeroPanelArtMount(
  root: HTMLElement,
  assets?: AssetLoader,
): HeroPanelArtMountPlan {
  const assetId = HERO_PANEL_SHELL_ASSET_ID;
  if (isHeroPanelArtSkinOff(root)) {
    return { assetId, mode: "placeholder" };
  }
  if (!assets || !heroPanelShellManifestReady(assets)) {
    return { assetId, mode: "placeholder" };
  }
  return { assetId, mode: "skinned" };
}

function clearHeroPanelShellBorderImage(root: HTMLElement): void {
  root.style.borderImageSource = "";
  root.style.borderImageSlice = "";
  root.style.borderImageWidth = "";
  root.style.borderImageRepeat = "";
  root.style.borderStyle = "";
  root.style.borderWidth = "";
}

function applyHeroPanelShellPlaceholder(root: HTMLElement): void {
  root.setAttribute(HERO_PANEL_ART_PLACEHOLDER_ATTR, "1");
  root.classList.add(HERO_PANEL_SHELL_PLACEHOLDER_CLASS);
  clearHeroPanelShellBorderImage(root);
}

function clearHeroPanelShellPlaceholder(root: HTMLElement): void {
  root.removeAttribute(HERO_PANEL_ART_PLACEHOLDER_ATTR);
  root.classList.remove(HERO_PANEL_SHELL_PLACEHOLDER_CLASS);
}

/** Mount `ui.panel.hero.v1` shell on hero panel root; respects `data-art-skin=off`. */
export function mountHeroPanelArtShell(
  root: HTMLElement,
  assets: AssetLoader,
  logicalW = 520,
  logicalH = 320,
): HeroPanelArtMountPlan {
  const plan = resolveHeroPanelArtMount(root, assets);
  root.setAttribute(HERO_PANEL_ART_PANEL_ATTR, plan.assetId);
  if (plan.mode === "skinned") {
    clearHeroPanelShellPlaceholder(root);
    skinHeroPanel(root, assets, logicalW, logicalH);
  } else {
    applyHeroPanelShellPlaceholder(root);
  }
  return plan;
}

function panelStateKindFromElement(el: HTMLElement): PanelStateKind | null {
  const attr = el.getAttribute("data-panel-state");
  if (attr === "loading" || attr === "empty" || attr === "error") return attr;
  if (el.classList.contains("panel-state-loading")) return "loading";
  if (el.classList.contains("panel-state-empty")) return "empty";
  if (el.classList.contains("panel-state-error")) return "error";
  return null;
}

/** Re-apply CLIENT-129 nine-slice on hero list/detail panel-state rows after shell mount. */
export function skimHeroPanelStateChrome(root: HTMLElement, assets?: AssetLoader): void {
  if (!assets || isHeroPanelArtSkinOff(root)) return;
  const seen = new Set<HTMLElement>();
  const nodes = root.querySelectorAll<HTMLElement>(
    "[data-panel-state], .panel-state-chrome[data-role='panel-state-chrome']",
  );
  for (const el of nodes) {
    if (seen.has(el)) continue;
    const kind = panelStateKindFromElement(el);
    if (!kind) continue;
    seen.add(el);
    applyPanelStateChrome(el, kind, assets);
  }
}

/** Shell mount + panelState skim (MainCityScene / list re-render). */
export function mountHeroPanelArtRuntime(
  root: HTMLElement,
  assets: AssetLoader,
  logicalW = 520,
  logicalH = 320,
): HeroPanelArtMountPlan {
  const plan = mountHeroPanelArtShell(root, assets, logicalW, logicalH);
  skimHeroPanelStateChrome(root, assets);
  return plan;
}
