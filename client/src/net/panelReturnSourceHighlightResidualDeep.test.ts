import { describe, expect, it, vi } from "vitest";
import {
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_MS,
} from "@/net/panelReturnSourceHighlightResidual";
import {
  highlightPanelReturnSourceCategoryResidualDeep,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_MS,
  pulsePanelReturnSourceCategoryResidualHighlights,
} from "@/net/panelReturnSourceHighlightResidualDeep";

describe("panelReturnSourceHighlightResidualDeep (CLIENT-272)", () => {
  it("highlightPanelReturnSourceCategoryResidualDeep pulses tab class for 2.5s", () => {
    const root = document.createElement("div");
    const tab = document.createElement("button");
    tab.setAttribute("data-bag-category", "all");
    root.appendChild(tab);

    const timeouts: Array<{ fn: () => void; ms: number }> = [];
    const windowObj = {
      setTimeout: (fn: () => void, ms?: number) => {
        timeouts.push({ fn, ms: ms ?? 0 });
        return timeouts.length;
      },
      clearTimeout: vi.fn(),
    };

    expect(highlightPanelReturnSourceCategoryResidualDeep(tab, root, windowObj)).toBe(true);
    expect(tab.classList.contains(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_CLASS)).toBe(true);
    expect(timeouts[0]?.ms).toBe(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_MS);
    timeouts[0]?.fn();
    expect(tab.classList.contains(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_CLASS)).toBe(false);
  });

  it("pulsePanelReturnSourceCategoryResidualHighlights stacks CLIENT-256 and CLIENT-272 classes", () => {
    const root = document.createElement("div");
    const tab = document.createElement("button");
    tab.setAttribute("data-shop-category", "resource");
    root.appendChild(tab);

    const timeouts: Array<{ fn: () => void; ms: number }> = [];
    const windowObj = {
      setTimeout: (fn: () => void, ms?: number) => {
        timeouts.push({ fn, ms: ms ?? 0 });
        return timeouts.length;
      },
      clearTimeout: vi.fn(),
    };

    expect(pulsePanelReturnSourceCategoryResidualHighlights(tab, root, windowObj)).toBe(true);
    expect(tab.classList.contains(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_CLASS)).toBe(true);
    expect(tab.classList.contains(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_CLASS)).toBe(true);
    expect(timeouts.some((t) => t.ms === PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_MS)).toBe(true);
    expect(timeouts.some((t) => t.ms === PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_MS)).toBe(true);
  });
});
