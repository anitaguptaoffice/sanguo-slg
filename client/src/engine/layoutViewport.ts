import { LAYOUT_FRAME } from "@/engine/mainCitySlots";

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

export function applyLayoutTransform(ctx: CanvasRenderingContext2D, vp: LayoutViewport): void {
  ctx.setTransform(vp.uiScale, 0, 0, vp.uiScale, vp.offsetX, vp.offsetY);
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
