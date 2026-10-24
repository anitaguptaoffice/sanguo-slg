import { describe, expect, it, vi } from "vitest";
import {
  highlightRankPinKeepResidualRing,
  RANK_PIN_KEEP_RESIDUAL_RING_CLASS,
  RANK_PIN_KEEP_RESIDUAL_RING_MS,
} from "@/net/rankPinKeepResidualRing";

describe("highlightRankPinKeepResidualRing (CLIENT-248)", () => {
  it("adds ring class then removes after duration", () => {
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

    expect(highlightRankPinKeepResidualRing(root, windowObj)).toBe(true);
    expect(tr.classList.contains(RANK_PIN_KEEP_RESIDUAL_RING_CLASS)).toBe(true);
    expect(timeouts[0]?.ms).toBe(RANK_PIN_KEEP_RESIDUAL_RING_MS);
    timeouts[0]?.fn();
    expect(tr.classList.contains(RANK_PIN_KEEP_RESIDUAL_RING_CLASS)).toBe(false);
  });

  it("returns false when pin row missing", () => {
    expect(highlightRankPinKeepResidualRing(document.createElement("div"))).toBe(false);
  });
});
