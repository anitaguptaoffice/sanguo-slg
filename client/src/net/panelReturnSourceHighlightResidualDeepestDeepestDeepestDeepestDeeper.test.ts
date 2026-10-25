import { describe, expect, it, vi } from "vitest";
import {
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_MS,
} from "@/net/panelReturnSourceHighlightResidual";
import {
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_MS,
  pulsePanelReturnSourceCategoryResidualHighlights,
} from "@/net/panelReturnSourceHighlightResidualDeep";
import {
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPER_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPER_MS,
} from "@/net/panelReturnSourceHighlightResidualDeeper";
import {
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_MS,
} from "@/net/panelReturnSourceHighlightResidualDeepest";
import {
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPER_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPER_MS,
} from "@/net/panelReturnSourceHighlightResidualDeepestDeeper";
import {
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPER_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPER_MS,
} from "@/net/panelReturnSourceHighlightResidualDeepestDeepestDeeper";
import {
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_MS,
} from "@/net/panelReturnSourceHighlightResidualDeepestDeepestDeepest";
import {
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_MS,
} from "@/net/panelReturnSourceHighlightResidualDeepestDeepestDeepestDeeper";
import {
  highlightPanelReturnSourceCategoryResidualDeepestDeepestDeepestDeepestDeeper,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_MS,
} from "@/net/panelReturnSourceHighlightResidualDeepestDeepestDeepestDeepestDeeper";

describe("panelReturnSourceHighlightResidualDeepestDeepestDeepestDeepestDeeper (CLIENT-384)", () => {
  it("highlightPanelReturnSourceCategoryResidualDeepestDeepestDeepestDeepestDeeper pulses tab class for 2.5s", () => {
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

    expect(
      highlightPanelReturnSourceCategoryResidualDeepestDeepestDeepestDeepestDeeper(tab, root, windowObj),
    ).toBe(true);
    expect(
      tab.classList.contains(
        PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_CLASS,
      ),
    ).toBe(true);
    expect(timeouts[0]?.ms).toBe(
      PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_MS,
    );
    timeouts[0]?.fn();
    expect(
      tab.classList.contains(
        PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_CLASS,
      ),
    ).toBe(false);
  });

  it("pulsePanelReturnSourceCategoryResidualHighlights stacks CLIENT-256 through CLIENT-384 classes", () => {
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
    expect(tab.classList.contains(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPER_CLASS)).toBe(true);
    expect(tab.classList.contains(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_CLASS)).toBe(
      true,
    );
    expect(tab.classList.contains(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPER_CLASS)).toBe(
      true,
    );
    expect(
      tab.classList.contains(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPER_CLASS),
    ).toBe(true);
    expect(
      tab.classList.contains(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_CLASS),
    ).toBe(true);
    expect(
      tab.classList.contains(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_CLASS),
    ).toBe(true);
    expect(
      tab.classList.contains(
        PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_CLASS,
      ),
    ).toBe(true);
    expect(timeouts.some((t) => t.ms === PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_MS)).toBe(true);
    expect(timeouts.some((t) => t.ms === PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEP_MS)).toBe(
      true,
    );
    expect(timeouts.some((t) => t.ms === PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPER_MS)).toBe(
      true,
    );
    expect(timeouts.some((t) => t.ms === PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_MS)).toBe(
      true,
    );
    expect(
      timeouts.some((t) => t.ms === PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPER_MS),
    ).toBe(true);
    expect(
      timeouts.some((t) => t.ms === PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPER_MS),
    ).toBe(true);
    expect(
      timeouts.some((t) => t.ms === PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_MS),
    ).toBe(true);
    expect(
      timeouts.some(
        (t) => t.ms === PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_MS,
      ),
    ).toBe(true);
    expect(
      timeouts.some(
        (t) =>
          t.ms === PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_MS,
      ),
    ).toBe(true);
  });
});
