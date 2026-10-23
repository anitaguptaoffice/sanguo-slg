import { describe, expect, it } from "vitest";
import {
  assertQueueTopEdgeInViewport,
  formatGeometryForInventory,
} from "./queueEvidenceViewport.mjs";

describe("queueEvidenceViewport", () => {
  it("accepts title and panel top inside viewport at scroll origin", () => {
    const geo = {
      scrollX: 0,
      scrollY: 0,
      viewportW: 1600,
      viewportH: 900,
      dpr: 1,
      panelRect: { top: 56, left: 480, width: 640, height: 788, right: 1120, bottom: 844, x: 480, y: 56 },
      titleRect: { top: 68, left: 492, width: 40, height: 20, right: 532, bottom: 88, x: 492, y: 68 },
    };
    expect(() => assertQueueTopEdgeInViewport(geo)).not.toThrow();
  });

  it("rejects non-zero document scroll", () => {
    const geo = {
      scrollX: 0,
      scrollY: 12,
      viewportW: 1280,
      viewportH: 720,
      dpr: 1,
      panelRect: { top: 40, left: 320, width: 640, height: 600, right: 960, bottom: 640, x: 320, y: 40 },
      titleRect: { top: 52, left: 332, width: 40, height: 20, right: 372, bottom: 72, x: 332, y: 52 },
    };
    expect(() => assertQueueTopEdgeInViewport(geo)).toThrow(/scroll/);
  });

  it("formats geometry for inventory rows", () => {
    const line = formatGeometryForInventory({
      scrollX: 0,
      scrollY: 0,
      viewportW: 1600,
      viewportH: 900,
      dpr: 2,
      panelRect: { left: 1, top: 2, width: 3, height: 4 },
      titleRect: { left: 5, top: 6, width: 7, height: 8 },
    });
    expect(line).toContain("1600×900");
    expect(line).toContain("@DPR2");
    expect(line).toContain("scroll (0, 0)");
  });
});
