import { describe, expect, it, vi } from "vitest";
import {
  highlightRankPinKeepResidualDeepRing,
  RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS,
  RANK_PIN_KEEP_RESIDUAL_DEEP_RING_MS,
} from "@/net/rankPinKeepResidualDeepRing";
import {
  highlightRankPinKeepResidualRing,
  RANK_PIN_KEEP_RESIDUAL_RING_CLASS,
} from "@/net/rankPinKeepResidualRing";

describe("highlightRankPinKeepResidualDeepRing (CLIENT-264)", () => {
  it("adds deep ring class then removes after 2s", () => {
    const root = document.createElement("div");
    const table = document.createElement("table");
    table.className = "rank-table";
    const tr = document.createElement("tr");
    tr.className = "rank-pin-row";
    table.appendChild(tr);
    root.appendChild(table);

    const timeouts: Array<{ fn: () => void; ms: number }> = [];
    const windowObj = {
      setTimeout: (fn: () => void, ms?: number) => {
        timeouts.push({ fn, ms: ms ?? 0 });
        return timeouts.length;
      },
      clearTimeout: vi.fn(),
    };

    expect(highlightRankPinKeepResidualDeepRing(root, windowObj)).toBe(true);
    expect(tr.classList.contains(RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS)).toBe(true);
    expect(timeouts[0]?.ms).toBe(RANK_PIN_KEEP_RESIDUAL_DEEP_RING_MS);
    timeouts[0]?.fn();
    expect(tr.classList.contains(RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS)).toBe(false);
  });

  it("stacks CLIENT-248 residual ring and CLIENT-264 deep ring", () => {
    const root = document.createElement("div");
    const table = document.createElement("table");
    table.className = "rank-table";
    const tr = document.createElement("tr");
    tr.className = "rank-pin-row";
    table.appendChild(tr);
    root.appendChild(table);

    const timeouts: Array<{ fn: () => void }> = [];
    const windowObj = {
      setTimeout: (fn: () => void) => {
        timeouts.push({ fn });
        return timeouts.length;
      },
      clearTimeout: vi.fn(),
    };

    highlightRankPinKeepResidualRing(root, windowObj);
    highlightRankPinKeepResidualDeepRing(root, windowObj);
    expect(tr.classList.contains(RANK_PIN_KEEP_RESIDUAL_RING_CLASS)).toBe(true);
    expect(tr.classList.contains(RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS)).toBe(true);
  });
});
