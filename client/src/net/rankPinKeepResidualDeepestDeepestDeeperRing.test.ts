import { describe, expect, it, vi } from "vitest";
import {
  highlightRankPinKeepResidualDeepestDeepestDeeperRing,
  RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS,
  RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_MS,
} from "@/net/rankPinKeepResidualDeepestDeepestDeeperRing";
import {
  highlightRankPinKeepResidualDeepestDeeperRing,
  RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPER_RING_CLASS,
} from "@/net/rankPinKeepResidualDeepestDeeperRing";
import {
  highlightRankPinKeepResidualDeepestRing,
  RANK_PIN_KEEP_RESIDUAL_DEEPEST_RING_CLASS,
} from "@/net/rankPinKeepResidualDeepestRing";
import {
  highlightRankPinKeepResidualDeeperRing,
  RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS,
} from "@/net/rankPinKeepResidualDeeperRing";
import {
  highlightRankPinKeepResidualDeepRing,
  RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS,
} from "@/net/rankPinKeepResidualDeepRing";
import {
  highlightRankPinKeepResidualRing,
  RANK_PIN_KEEP_RESIDUAL_RING_CLASS,
} from "@/net/rankPinKeepResidualRing";

describe("highlightRankPinKeepResidualDeepestDeepestDeeperRing (CLIENT-328)", () => {
  it("adds deepest-deepest-deeper ring class then removes after 3s", () => {
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

    expect(highlightRankPinKeepResidualDeepestDeepestDeeperRing(root, windowObj)).toBe(true);
    expect(tr.classList.contains(RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS)).toBe(
      true,
    );
    expect(timeouts[0]?.ms).toBe(RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_MS);
    timeouts[0]?.fn();
    expect(tr.classList.contains(RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS)).toBe(
      false,
    );
  });

  it("stacks CLIENT-248/264/280/296/312 rings and CLIENT-328 deepest-deepest-deeper ring", () => {
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
    highlightRankPinKeepResidualDeeperRing(root, windowObj);
    highlightRankPinKeepResidualDeepestRing(root, windowObj);
    highlightRankPinKeepResidualDeepestDeeperRing(root, windowObj);
    highlightRankPinKeepResidualDeepestDeepestDeeperRing(root, windowObj);
    expect(tr.classList.contains(RANK_PIN_KEEP_RESIDUAL_RING_CLASS)).toBe(true);
    expect(tr.classList.contains(RANK_PIN_KEEP_RESIDUAL_DEEP_RING_CLASS)).toBe(true);
    expect(tr.classList.contains(RANK_PIN_KEEP_RESIDUAL_DEEPER_RING_CLASS)).toBe(true);
    expect(tr.classList.contains(RANK_PIN_KEEP_RESIDUAL_DEEPEST_RING_CLASS)).toBe(true);
    expect(tr.classList.contains(RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPER_RING_CLASS)).toBe(true);
    expect(tr.classList.contains(RANK_PIN_KEEP_RESIDUAL_DEEPEST_DEEPEST_DEEPER_RING_CLASS)).toBe(
      true,
    );
  });
});
