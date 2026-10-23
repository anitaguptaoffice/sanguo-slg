import { LAYOUT_FRAME, MIN_CONTENT_VIEWPORT } from "@/engine/mainCitySlots";

export { MIN_CONTENT_VIEWPORT };

export type LayoutViewport = {
  uiScale: number;
  offsetX: number;
  offsetY: number;
  cssWidth: number;
  cssHeight: number;
};

/** Letterboxed fit of 1600×900 design frame into the canvas CSS box. */
export function computeLayoutViewport(
  cssWidth: number,
  cssHeight: number,
  designW = LAYOUT_FRAME.w,
  designH = LAYOUT_FRAME.h,
): LayoutViewport {
  const uiScale = Math.min(cssWidth / designW, cssHeight / designH);
  const contentW = designW * uiScale;
  const contentH = designH * uiScale;
  const offsetX = (cssWidth - contentW) / 2;
  const offsetY = (cssHeight - contentH) / 2;
  return { uiScale, offsetX, offsetY, cssWidth, cssHeight };
}

/** Multiplies the current canvas transform (e.g. GameApp DPR scale) — do not use setTransform here. */
export function applyLayoutTransform(ctx: CanvasRenderingContext2D, vp: LayoutViewport): void {
  ctx.transform(vp.uiScale, 0, 0, vp.uiScale, vp.offsetX, vp.offsetY);
}

export function layoutToCanvas(
  layoutX: number,
  layoutY: number,
  vp: LayoutViewport,
): { x: number; y: number } {
  return {
    x: vp.offsetX + layoutX * vp.uiScale,
    y: vp.offsetY + layoutY * vp.uiScale,
  };
}

export function canvasToLayout(
  canvasX: number,
  canvasY: number,
  vp: LayoutViewport,
): { x: number; y: number } {
  return {
    x: (canvasX - vp.offsetX) / vp.uiScale,
    y: (canvasY - vp.offsetY) / vp.uiScale,
  };
}

/** CSS size of the scaled 1600×900 layout frame (letterbox content box). */
export function layoutFrameCssSize(vp: LayoutViewport): { width: number; height: number } {
  return {
    width: LAYOUT_FRAME.w * vp.uiScale,
    height: LAYOUT_FRAME.h * vp.uiScale,
  };
}

/** Position the DOM layout frame inside a full-viewport root (offsets from letterboxing). */
export function applyLayoutFrameStyles(frame: HTMLElement, vp: LayoutViewport): void {
  const { width, height } = layoutFrameCssSize(vp);
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  frame.style.left = `${vp.offsetX}px`;
  frame.style.top = `${vp.offsetY}px`;
}

/** Minimum uiScale so a layout-space hit box of `layoutPx` stays ≥ `minCssPx` on screen. */
export function minUiScaleForHitSize(layoutPx: number, minCssPx = 44): number {
  return minCssPx / layoutPx;
}
