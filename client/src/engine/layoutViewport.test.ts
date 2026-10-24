import { describe, expect, it } from "vitest";
import {
  applyLayoutFrameStyles,
  applyLayoutTransform,
  canvasToLayout,
  computeLayoutViewport,
  isNarrowLayoutViewport,
  layoutFrameCssSize,
  layoutToCanvas,
  layoutViewportRootClass,
  minUiScaleForHitSize,
  NARROW_LAYOUT_ROOT_CLASS,
  syncLayoutViewportRootClass,
  CLIENT_111_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_119_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_127_NARROW_MANIFEST_CENTER_PANEL_IDS,
  CLIENT_135_NARROW_MANIFEST_CENTER_PANEL_IDS,
} from "@/engine/layoutViewport";
import { LAYOUT_FRAME, MIN_CONTENT_VIEWPORT } from "@/engine/mainCitySlots";
import {
  NARROW_SCROLL_CENTER_PANEL_IDS,
  NARROW_SCROLL_SIDEBAR_PANEL_IDS,
} from "@/ui/contentPanelScroll";

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

describe("applyLayoutTransform", () => {
  it("multiplies an existing DPR scale instead of replacing it", () => {
    const dpr = 2;
    let a = dpr;
    let d = dpr;
    const ctx = {
      transform(sx: number, _0: number, _1: number, sy: number) {
        a *= sx;
        d *= sy;
      },
    } as CanvasRenderingContext2D;
    const vp = computeLayoutViewport(1600, 900);
    applyLayoutTransform(ctx, vp);
    expect(a).toBeCloseTo(dpr * vp.uiScale, 5);
    expect(d).toBeCloseTo(dpr * vp.uiScale, 5);
  });
});

describe("minUiScaleForHitSize", () => {
  it("requires scale ≥ 44/220 for a 220px-wide hit rect", () => {
    expect(minUiScaleForHitSize(220)).toBeCloseTo(0.2, 5);
  });
});

describe("narrow layout root class", () => {
  it("enables layout-narrow at 1280×720 minimum content viewport", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(layoutViewportRootClass(vp)).toBe(NARROW_LAYOUT_ROOT_CLASS);
  });

  it("keeps 1600×900 baseline without narrow class", () => {
    const vp = computeLayoutViewport(1600, 900);
    expect(isNarrowLayoutViewport(vp)).toBe(false);
    expect(layoutViewportRootClass(vp)).toBe("");
  });

  it("applyLayoutFrameStyles sets --ui-scale on layout frame", () => {
    const root = document.createElement("div");
    const vp = computeLayoutViewport(1280, 720);
    applyLayoutFrameStyles(root, vp);
    expect(root.style.getPropertyValue("--ui-scale")).toBe(String(vp.uiScale));
  });

  it("syncLayoutViewportRootClass toggles on #layout-frame", () => {
    const root = document.createElement("div");
    syncLayoutViewportRootClass(root, computeLayoutViewport(1280, 720));
    expect(root.classList.contains(NARROW_LAYOUT_ROOT_CLASS)).toBe(true);
    syncLayoutViewportRootClass(root, computeLayoutViewport(1600, 900));
    expect(root.classList.contains(NARROW_LAYOUT_ROOT_CLASS)).toBe(false);
  });

  it("CLIENT-095 economy/social panels participate in narrow scroll registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    for (const id of ["bag", "shop", "guild", "chat"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
  });

  it("CLIENT-103 rank hero daily panels participate in narrow scroll registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    for (const id of ["rank", "hero", "daily"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
  });

  it("CLIENT-111 building mail queue manifest registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    for (const id of CLIENT_111_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(["building", "mail", "queue"]).toContain(id);
    }
    expect(NARROW_SCROLL_SIDEBAR_PANEL_IDS).toContain("building");
    for (const id of ["mail", "queue"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
  });

  it("CLIENT-119 bag shop hero military manifest registry at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_119_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "bag",
      "shop",
      "hero",
      "military",
    ]);
    for (const id of CLIENT_119_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
  });

  it("CLIENT-127 mail daily march battle-report filter-list manifest at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_127_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual([
      "mail",
      "daily",
      "march",
      "battle-report",
    ]);
    for (const id of CLIENT_127_NARROW_MANIFEST_CENTER_PANEL_IDS) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
  });

  it("CLIENT-135 building queue hero HUD narrow manifest at 1280×720", () => {
    const vp = computeLayoutViewport(MIN_CONTENT_VIEWPORT.w, MIN_CONTENT_VIEWPORT.h);
    expect(isNarrowLayoutViewport(vp)).toBe(true);
    expect(CLIENT_135_NARROW_MANIFEST_CENTER_PANEL_IDS).toEqual(["building", "queue", "hero"]);
    expect(NARROW_SCROLL_SIDEBAR_PANEL_IDS).toContain("building");
    for (const id of ["queue", "hero"] as const) {
      expect(NARROW_SCROLL_CENTER_PANEL_IDS).toContain(id);
    }
  });
});
