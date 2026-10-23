import { MIN_CONTENT_VIEWPORT } from "@/engine/mainCitySlots";
import { computeLayoutViewport } from "@/engine/layoutViewport";

export const TOOLBAR_BTN_LAYOUT_W = 96;
export const TOOLBAR_BTN_LAYOUT_H = 44;
export const MIN_TOOLBAR_HIT_CSS_PX = 44;

/** Layout-space min height so screen CSS hit ≥ minCssPx at the given uiScale. */
export function toolbarHitMinLayoutPx(uiScale: number, minCssPx = MIN_TOOLBAR_HIT_CSS_PX): number {
  if (uiScale <= 0) return minCssPx;
  return minCssPx / uiScale;
}

export function toolbarHitWrapMinHeightCss(uiScale: number, minCssPx = MIN_TOOLBAR_HIT_CSS_PX): string {
  return `calc(${minCssPx}px / ${uiScale})`;
}

/** Screen CSS size of a layout-space box inside the scaled layout frame. */
export function layoutBoxToScreenCss(
  layoutW: number,
  layoutH: number,
  uiScale: number,
): { width: number; height: number } {
  return { width: layoutW * uiScale, height: layoutH * uiScale };
}

export function narrow1280UiScale(): number {
  return computeLayoutViewport(
    MIN_CONTENT_VIEWPORT.w,
    MIN_CONTENT_VIEWPORT.h,
  ).uiScale;
}
