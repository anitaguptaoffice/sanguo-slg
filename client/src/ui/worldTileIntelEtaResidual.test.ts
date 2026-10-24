import { describe, expect, it, vi } from "vitest";
import {
  createWorldTileIntelEtaResidualTimers,
  formatMarchIntelEtaResidualCoordLine,
  formatWorldTileIntelEtaResidualLine,
  MARCH_INTEL_ETA_RESIDUAL_COORD_CLASS,
  MARCH_INTEL_ETA_RESIDUAL_COORD_HIGHLIGHT_CLASS,
  MARCH_INTEL_ETA_RESIDUAL_COORD_ROLE,
  pulseWorldTileIntelEtaResidualMutualHighlight,
  resetWorldTileIntelEtaResidualTimersForTests,
  WORLD_TILE_INTEL_ETA_RESIDUAL_RING_CLASS,
  WORLD_TILE_INTEL_ETA_RESIDUAL_RING_MS,
  worldTileIntelEtaResidualCoordsMatch,
} from "@/ui/worldTileIntelEtaResidual";

describe("formatWorldTileIntelEtaResidualLine (CLIENT-237)", () => {
  const now = 1_700_000_000_000;

  it("includes grid coords and phase/ETA from recent in-progress march", () => {
    const marches = [
      {
        march_id: 9,
        to_x: 4,
        to_y: 5,
        phase: 2,
        arrive_at_ms: now + 30_000,
        depart_at_ms: now - 10_000,
      },
    ];
    const line = formatWorldTileIntelEtaResidualLine(marches, { x: 4, y: 5 }, now);
    expect(line).toContain("格点 (4,5)");
    expect(line).toContain("军情 #9");
    expect(line).toContain("行军中");
  });

  it("shows empty hint when no in-progress march at tile", () => {
    const line = formatWorldTileIntelEtaResidualLine([], { x: 1, y: 2 }, now);
    expect(line).toContain("格点 (1,2)");
    expect(line).toContain("暂无进行中军情 ETA 对照");
  });
});

describe("formatMarchIntelEtaResidualCoordLine (CLIENT-237)", () => {
  it("formats destination coords for intel info card", () => {
    expect(formatMarchIntelEtaResidualCoordLine({ to_x: 3, to_y: 8 })).toBe("目的格 (3,8)");
    expect(formatMarchIntelEtaResidualCoordLine({ to_x: undefined, to_y: 1 })).toBeNull();
  });
});

describe("worldTileIntelEtaResidualCoordsMatch", () => {
  it("matches grid to march destination", () => {
    expect(worldTileIntelEtaResidualCoordsMatch({ x: 2, y: 3 }, { to_x: 2, to_y: 3 })).toBe(true);
    expect(worldTileIntelEtaResidualCoordsMatch({ x: 2, y: 3 }, { to_x: 4, to_y: 3 })).toBe(false);
  });
});

describe("pulseWorldTileIntelEtaResidualMutualHighlight (CLIENT-237)", () => {
  it("applies ring and coord highlight then clears after TTL", () => {
    vi.useFakeTimers();
    const worldCard = document.createElement("aside");
    worldCard.setAttribute("data-role", "world-tile-info");
    const intel = document.createElement("div");
    intel.innerHTML = `
      <aside data-role="march-info-card">
        <p data-role="${MARCH_INTEL_ETA_RESIDUAL_COORD_ROLE}" class="${MARCH_INTEL_ETA_RESIDUAL_COORD_CLASS}">目的格 (1,2)</p>
      </aside>
    `;
    const coord = intel.querySelector(`[data-role="${MARCH_INTEL_ETA_RESIDUAL_COORD_ROLE}"]`)!;
    const timers = createWorldTileIntelEtaResidualTimers();

    pulseWorldTileIntelEtaResidualMutualHighlight(worldCard, intel, true, { timers });
    expect(worldCard.classList.contains(WORLD_TILE_INTEL_ETA_RESIDUAL_RING_CLASS)).toBe(true);
    expect(coord.classList.contains(MARCH_INTEL_ETA_RESIDUAL_COORD_HIGHLIGHT_CLASS)).toBe(true);

    vi.advanceTimersByTime(WORLD_TILE_INTEL_ETA_RESIDUAL_RING_MS);
    expect(worldCard.classList.contains(WORLD_TILE_INTEL_ETA_RESIDUAL_RING_CLASS)).toBe(false);
    expect(coord.classList.contains(MARCH_INTEL_ETA_RESIDUAL_COORD_HIGHLIGHT_CLASS)).toBe(false);

    resetWorldTileIntelEtaResidualTimersForTests(timers);
    vi.useRealTimers();
  });
});
