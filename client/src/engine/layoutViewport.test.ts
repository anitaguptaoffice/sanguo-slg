import { describe, expect, it } from "vitest";
import {
  canvasToLayout,
  computeLayoutViewport,
  layoutFrameCssSize,
  layoutToCanvas,
  minUiScaleForHitSize,
} from "@/engine/layoutViewport";
import { LAYOUT_FRAME, MIN_CONTENT_VIEWPORT } from "@/engine/mainCitySlots";

describe("computeLayoutViewport", () => {
  it("fits 1600×900 design at 1:1 on a 1600×900 viewport", () => {
    const vp = computeLayoutViewport(1600, 900);
    expect(vp.uiScale).toBe(1);
    expect(vp.offsetX).toBe(0);
    expect(vp.offsetY).toBe(0);
  });

  it("uses uiScale = min(vw/1600, vh/900) at minimum content 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(vp.uiScale).toBeCloseTo(0.8, 5);
    expect(layoutFrameCssSize(vp).width).toBeCloseTo(1280, 5);
    expect(layoutFrameCssSize(vp).height).toBeCloseTo(720, 5);
  });

  it("letterboxes a tall narrow viewport", () => {
    const vp = computeLayoutViewport(400, 900);
    expect(vp.uiScale).toBeCloseTo(400 / LAYOUT_FRAME.w, 5);
    expect(vp.offsetY).toBeGreaterThan(0);
    expect(vp.offsetX).toBe(0);
  });

  it("letterboxes an ultra-wide viewport", () => {
    const vp = computeLayoutViewport(2000, 900);
    expect(vp.uiScale).toBe(1);
    expect(vp.offsetX).toBe(200);
    expect(vp.offsetY).toBe(0);
  });

  it("round-trips layout ↔ canvas coordinates", () => {
    const vp = computeLayoutViewport(1280, 720);
    const p = layoutToCanvas(640, 450, vp);
    const back = canvasToLayout(p.x, p.y, vp);
    expect(back.x).toBeCloseTo(640, 5);
    expect(back.y).toBeCloseTo(450, 5);
  });
});

describe("minUiScaleForHitSize", () => {
  it("requires scale ≥ 44/220 for a 220px-wide hit rect", () => {
    expect(minUiScaleForHitSize(220)).toBeCloseTo(0.2, 5);
  });
});
