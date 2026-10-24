import { describe, expect, it, vi } from "vitest";
import {
  consumePanelReturnSourceSession,
  highlightPanelReturnSourceCategoryResidual,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_CLASS,
  PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_MS,
  PANEL_RETURN_SOURCE_SESSION_KEY,
  serializePanelReturnSourcePayload,
  writePanelReturnSourceSession,
} from "@/net/panelReturnSourceHighlightResidual";

describe("panelReturnSourceHighlightResidual (CLIENT-256)", () => {
  it("serializes and consumes session payload once", () => {
    const storage = {
      data: new Map<string, string>(),
      getItem(key: string) {
        return this.data.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        this.data.set(key, value);
      },
      removeItem(key: string) {
        this.data.delete(key);
      },
    };
    writePanelReturnSourceSession(
      { targetPanel: "bag", categoryId: "consumable", sourceKind: "rank" },
      storage,
    );
    expect(storage.getItem(PANEL_RETURN_SOURCE_SESSION_KEY)).toContain("consumable");
    const consumed = consumePanelReturnSourceSession(storage);
    expect(consumed?.sourceKind).toBe("rank");
    expect(storage.getItem(PANEL_RETURN_SOURCE_SESSION_KEY)).toBeNull();
  });

  it("highlightPanelReturnSourceCategoryResidual pulses tab class", () => {
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

    expect(highlightPanelReturnSourceCategoryResidual(tab, root, windowObj)).toBe(true);
    expect(tab.classList.contains(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_CLASS)).toBe(true);
    expect(timeouts[0]?.ms).toBe(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_MS);
    timeouts[0]?.fn();
    expect(tab.classList.contains(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_CLASS)).toBe(false);
  });

  it("serializePanelReturnSourcePayload round-trips", () => {
    const raw = serializePanelReturnSourcePayload({
      targetPanel: "shop",
      categoryId: "resource",
      sourceKind: "intel",
    });
    expect(raw).toContain('"intel"');
  });
});
