import type { AssetLoader } from "@/engine/AssetLoader";

export const HUD_BAR_ASSET = "ui.hud.bar.v1";
export const TOOLBAR_BAR_ASSET = "ui.toolbar.bar.v1";
export const TOOLBAR_BAR_LAYOUT_H = 56;

/** Stretch a full-width HUD / toolbar bar sprite (1600×56 layout) as the element background. */
export function skinLayoutBarStrip(
  el: HTMLElement,
  assets: AssetLoader,
  assetId: string,
  logicalH = TOOLBAR_BAR_LAYOUT_H,
): void {
  if (el.dataset.artSkin === "off") return;
  const pack = assets.getImageForAsset(assetId);
  if (!pack) return;
  el.style.backgroundImage = `url(${pack.img.src})`;
  el.style.backgroundSize = `100% ${logicalH}px`;
  el.style.backgroundRepeat = "no-repeat";
  el.style.backgroundPosition = "left top";
  el.style.backgroundColor = "transparent";
  el.dataset.artChromeBar = assetId;
}

export function skinHudBar(el: HTMLElement, assets: AssetLoader): void {
  el.classList.add("art-chrome-hud");
  skinLayoutBarStrip(el, assets, HUD_BAR_ASSET);
}

export function skinToolbarBar(el: HTMLElement, assets: AssetLoader): void {
  el.classList.add("art-chrome-toolbar");
  skinLayoutBarStrip(el, assets, TOOLBAR_BAR_ASSET);
}

export function clearHudBarChrome(el: HTMLElement): void {
  el.classList.remove("art-chrome-hud");
  delete el.dataset.artChromeBar;
  el.style.backgroundImage = "";
  el.style.backgroundSize = "";
  el.style.backgroundRepeat = "";
  el.style.backgroundPosition = "";
  el.style.backgroundColor = "";
}

export function clearToolbarBarChrome(el: HTMLElement): void {
  el.classList.remove("art-chrome-toolbar");
  delete el.dataset.artChromeBar;
  el.style.backgroundImage = "";
  el.style.backgroundSize = "";
  el.style.backgroundRepeat = "";
  el.style.backgroundPosition = "";
  el.style.backgroundColor = "";
}

/** Wrap each toolbar button for expanded hit slop without changing 96×44 art draw. */
export function wrapToolbarButtonsForHit(root: HTMLElement): void {
  const scroll = root.querySelector(".toolbar-scroll-inner");
  if (!scroll) return;
  const buttons = Array.from(scroll.querySelectorAll<HTMLButtonElement>(":scope > button"));
  for (const btn of buttons) {
    if (btn.parentElement?.classList.contains("toolbar-btn-hit")) continue;
    const wrap = document.createElement("div");
    wrap.className = "toolbar-btn-hit";
    btn.parentElement?.insertBefore(wrap, btn);
    wrap.appendChild(btn);
  }
}
