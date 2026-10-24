import { describe, expect, it } from "vitest";
import {
  HERO_HOST_SCROLL_CLIP_MARKER,
  axisRectFullyContains,
  collectClippingAncestorRects,
  domRectToAxis,
  effectiveVisibleClipForTargets,
  intersectAxisRects,
  unionAxisRects,
} from "@/ui/heroDetailScrollClip";

describe("heroDetailScrollClip (HERO-HOST)", () => {
  it("intersects clip rects and tests containment", () => {
    const a = { left: 0, top: 0, right: 100, bottom: 100 };
    const b = { left: 40, top: 40, right: 80, bottom: 80 };
    const i = intersectAxisRects(a, b);
    expect(i).toEqual(b);
    expect(axisRectFullyContains(b, a)).toBe(true);
    expect(axisRectFullyContains(a, b)).toBe(false);
  });

  it("unions bust + name boxes", () => {
    const bust = { left: 10, top: 20, right: 138, bottom: 180 };
    const name = { left: 148, top: 24, right: 220, bottom: 44 };
    const u = unionAxisRects(bust, name);
    expect(u.left).toBe(10);
    expect(u.right).toBe(220);
    expect(u.top).toBe(20);
    expect(u.bottom).toBe(180);
  });

  it("collectClippingAncestorRects includes viewport and overflow parent", () => {
    const root = document.createElement("div");
    root.style.overflow = "hidden";
    root.style.width = "200px";
    root.style.height = "120px";
    document.body.appendChild(root);
    const child = document.createElement("span");
    root.appendChild(child);
    const clips = collectClippingAncestorRects(child);
    expect(clips.length).toBeGreaterThanOrEqual(2);
    expect(clips[0]).toEqual({
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
    });
    document.body.removeChild(root);
  });

  it("effectiveVisibleClipForTargets narrows to smallest ancestor clip", () => {
    const outer = document.createElement("div");
    outer.style.overflow = "hidden";
    outer.style.position = "fixed";
    outer.style.left = "0";
    outer.style.top = "0";
    outer.style.width = "300px";
    outer.style.height = "200px";
    document.body.appendChild(outer);
    const inner = document.createElement("div");
    outer.appendChild(inner);
    const clip = effectiveVisibleClipForTargets([inner]);
    expect(clip).toBeTruthy();
    const outerBox = domRectToAxis(outer.getBoundingClientRect());
    expect(clip!.left).toBeGreaterThanOrEqual(outerBox.left - 1);
    expect(clip!.right).toBeLessThanOrEqual(outerBox.right + 1);
    document.body.removeChild(outer);
  });

  it("exports HERO_HOST_SCROLL_CLIP_MARKER for index.html contract", () => {
    expect(HERO_HOST_SCROLL_CLIP_MARKER).toBe("HERO-HOST-SCROLL-CLIP");
  });
});
