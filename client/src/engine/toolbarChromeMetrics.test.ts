import { describe, expect, it } from "vitest";
import {
  layoutBoxToScreenCss,
  narrow1280UiScale,
  toolbarHitMinLayoutPx,
  TOOLBAR_BTN_LAYOUT_H,
  TOOLBAR_BTN_LAYOUT_W,
} from "@/engine/toolbarChromeMetrics";

describe("toolbarChromeMetrics", () => {
  it("1280×720 uiScale is 0.8 and visual button is below 44px hit without wrap", () => {
    const uiScale = narrow1280UiScale();
    expect(uiScale).toBeCloseTo(0.8, 5);
    const visual = layoutBoxToScreenCss(TOOLBAR_BTN_LAYOUT_W, TOOLBAR_BTN_LAYOUT_H, uiScale);
    expect(visual.height).toBeCloseTo(35.2, 5);
    expect(visual.width).toBeGreaterThanOrEqual(44);
    const hitMin = toolbarHitMinLayoutPx(uiScale);
    expect(hitMin).toBeCloseTo(55, 5);
    expect(hitMin).toBeGreaterThan(TOOLBAR_BTN_LAYOUT_H);
  });
});
