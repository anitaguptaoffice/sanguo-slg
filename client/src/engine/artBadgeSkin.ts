import type { AssetLoader } from "@/engine/AssetLoader";

/** ART-UI-FILTER-008 count/dot assets (#509 `artUiFilterSkin`). */
export const BADGE_DOT_ASSET_ID = "ui.badge.dot.v1";
export const BADGE_COUNT_ASSET_ID = "ui.badge.count.v1";

export const BADGE_COUNT_DISPLAY_W = 20;
export const BADGE_COUNT_DISPLAY_H = 16;

export const UI_BADGE_DOT_CLASS = "ui-badge-dot";
export const UI_BADGE_COUNT_CLASS = "ui-badge-count";

/** Count badge label: 1–9 digits, overflow as 9+ (frozen #108). */
export function formatBadgeCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "";
  if (count > 9) return "9+";
  return String(Math.trunc(count));
}

export function isArtSkinOff(el: HTMLElement): boolean {
  return el.dataset.artSkin === "off" || el.closest("[data-art-skin='off']") != null;
}

function clearDotSprite(el: HTMLElement): void {
  el.classList.remove("art-badge-dot", "art-badge-dot--skinned", "art-filter-badge-dot", "art-filter-badge-dot--skinned");
  el.querySelector(".art-badge-dot-sprite, .art-filter-badge-dot-sprite")?.remove();
}

function clearCountSprite(el: HTMLElement): void {
  el.classList.remove("art-badge-count", "art-badge-count--skinned", "art-filter-badge-count", "art-filter-badge-count--skinned");
  el.querySelector(".art-badge-count-sprite, .art-filter-badge-count-sprite")?.remove();
}

/** Remove manifest chrome; keeps host element for reuse. */
export function teardownBadgeChrome(el: HTMLElement): void {
  clearDotSprite(el);
  clearCountSprite(el);
}

export function mountBadgeDot(el: HTMLElement, assets: AssetLoader): void {
  if (isArtSkinOff(el)) {
    clearDotSprite(el);
    el.classList.add(UI_BADGE_DOT_CLASS);
    return;
  }
  const pack = assets.getImageForAsset(BADGE_DOT_ASSET_ID);
  if (!pack) return;
  el.classList.add(UI_BADGE_DOT_CLASS, "art-badge-dot", "art-badge-dot--skinned");
  let sprite = el.querySelector<HTMLSpanElement>(".art-badge-dot-sprite");
  if (!sprite) {
    sprite = document.createElement("span");
    sprite.className = "art-badge-dot-sprite";
    sprite.setAttribute("aria-hidden", "true");
    el.appendChild(sprite);
  }
  sprite.style.backgroundImage = `url(${pack.img.src})`;
}

export function mountBadgeCount(el: HTMLElement, assets: AssetLoader, count: number): void {
  const labelText = formatBadgeCount(count);
  if (!labelText) {
    hideCountBadgeElement(el);
    return;
  }
  el.hidden = false;
  el.classList.remove("hidden");
  el.removeAttribute("aria-hidden");
  if (isArtSkinOff(el)) {
    clearCountSprite(el);
    el.classList.add(UI_BADGE_COUNT_CLASS);
    el.textContent = labelText;
    return;
  }
  const pack = assets.getImageForAsset(BADGE_COUNT_ASSET_ID);
  if (!pack) {
    el.classList.add(UI_BADGE_COUNT_CLASS);
    el.textContent = labelText;
    return;
  }
  el.classList.add(UI_BADGE_COUNT_CLASS, "art-badge-count", "art-badge-count--skinned");
  let sprite = el.querySelector<HTMLSpanElement>(".art-badge-count-sprite");
  if (!sprite) {
    el.textContent = "";
    sprite = document.createElement("span");
    sprite.className = "art-badge-count-sprite";
    const label = document.createElement("span");
    label.className = "art-badge-count-label";
    sprite.appendChild(label);
    el.appendChild(sprite);
  }
  const label = sprite.querySelector<HTMLSpanElement>(".art-badge-count-label");
  sprite.style.backgroundImage = `url(${pack.img.src})`;
  if (label) label.textContent = labelText;
}

/** #108: count ≤ 0 must hide the entire badge host (no empty red plate). */
export function hideCountBadgeElement(el: HTMLElement, hiddenClass = "hidden"): void {
  el.hidden = true;
  el.classList.add(hiddenClass);
  el.setAttribute("aria-hidden", "true");
  el.textContent = "";
  teardownBadgeChrome(el);
}

export type ApplyUiCountBadgeOptions = {
  assets?: AssetLoader;
  hiddenClass?: string;
  /** CSS-only label when art skin is off or assets missing. */
  fallbackText?: (count: number, formatted: string) => string;
};

/**
 * Unified count badge mount for toolbar / HUD / mail tabs.
 * Returns whether the badge is visible after apply.
 */
export function applyUiCountBadge(
  el: HTMLElement | null | undefined,
  count: number,
  options: ApplyUiCountBadgeOptions = {},
): boolean {
  if (!el) return false;
  const hiddenClass = options.hiddenClass ?? "hidden";
  const formatted = formatBadgeCount(count);
  if (!formatted) {
    hideCountBadgeElement(el, hiddenClass);
    return false;
  }
  el.hidden = false;
  el.classList.remove(hiddenClass);
  el.removeAttribute("aria-hidden");
  const displayText = options.fallbackText?.(count, formatted) ?? formatted;
  if (options.assets) {
    mountBadgeCount(el, options.assets, count);
    if (isArtSkinOff(el) || !options.assets.getImageForAsset(BADGE_COUNT_ASSET_ID)) {
      el.textContent = displayText;
    }
  } else {
    teardownBadgeChrome(el);
    el.classList.add(UI_BADGE_COUNT_CLASS);
    el.textContent = displayText;
  }
  return true;
}
