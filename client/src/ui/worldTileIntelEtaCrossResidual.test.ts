import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWorldTileIntelEtaCrossResidualTimers,
  formatWorldTileIntelEtaCrossResidualLine,
  MARCH_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS,
  resetWorldTileIntelEtaCrossResidualTimersForTests,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_MS,
  pulseWorldTileIntelEtaCrossResidualReadonly,
} from "@/ui/worldTileIntelEtaCrossResidual";
import { MARCH_INTEL_PHASE_ETA_STRIP_CLASS } from "@/net/marchIntelPhaseEtaStrip";

describe("formatWorldTileIntelEtaCrossResidualLine (CLIENT-252)", () => {
  const now = 1_700_000_000_000;

  it("returns null when selected march dest does not match tile", () => {
    expect(
      formatWorldTileIntelEtaCrossResidualLine(
        [],
        { x: 1, y: 2 },
        { march_id: 1, to_x: 9, to_y: 9 },
        now,
      ),
    ).toBeNull();
  });

  it("builds readonly cross line when coords match", () => {
    const marches = [
      {
        march_id: 5,
        to_x: 4,
        to_y: 5,
        phase: 2,
        arrive_at_ms: now + 60_000,
        depart_at_ms: now - 1000,
      },
    ];
    const line = formatWorldTileIntelEtaCrossResidualLine(
      marches,
      { x: 4, y: 5 },
      marches[0],
      now,
    );
    expect(line).toContain("只读对照");
    expect(line).toContain("#5");
  });
});

describe("pulseWorldTileIntelEtaCrossResidualReadonly (CLIENT-252)", () => {
  afterEach(() => {
    resetWorldTileIntelEtaCrossResidualTimersForTests(
      createWorldTileIntelEtaCrossResidualTimers(),
    );
  });

  it("pulses cross residual line and march phase eta strip", () => {
    vi.useFakeTimers();
    const worldCard = document.createElement("aside");
    worldCard.innerHTML = `<p data-role="world-tile-intel-eta-cross-residual-line"></p>`;
    const intelRoot = document.createElement("div");
    intelRoot.innerHTML = `
      <p data-role="march-info-card-phase-eta-strip" class="${MARCH_INTEL_PHASE_ETA_STRIP_CLASS}">ETA</p>
    `;
    const timers = createWorldTileIntelEtaCrossResidualTimers();
    const crossLine = worldCard.querySelector("p") as HTMLElement;
    const strip = intelRoot.querySelector("p") as HTMLElement;

    pulseWorldTileIntelEtaCrossResidualReadonly(worldCard, intelRoot, true, { timers });
    expect(crossLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS)).toBe(
      true,
    );
    expect(strip.classList.contains(MARCH_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS)).toBe(true);

    vi.advanceTimersByTime(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_MS);
    expect(crossLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS)).toBe(
      false,
    );
    expect(strip.classList.contains(MARCH_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS)).toBe(false);
    vi.useRealTimers();
  });
});
