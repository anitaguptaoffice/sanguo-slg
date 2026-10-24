import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWorldTileIntelEtaCrossResidualTimers,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_MS,
} from "@/ui/worldTileIntelEtaCrossResidual";
import {
  createWorldTileIntelEtaCrossResidualDeepTimers,
  formatWorldTileIntelEtaCrossResidualDeepLine,
  resetWorldTileIntelEtaCrossResidualDeepTimersForTests,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_MS,
  pulseWorldTileIntelEtaCrossResidualDeepReadonly,
} from "@/ui/worldTileIntelEtaCrossResidualDeep";
import { MARCH_INTEL_PHASE_ETA_STRIP_CLASS } from "@/net/marchIntelPhaseEtaStrip";
import { MARCH_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS } from "@/ui/worldTileIntelEtaCrossResidual";

describe("formatWorldTileIntelEtaCrossResidualDeepLine (CLIENT-268)", () => {
  const now = 1_700_000_000_000;

  it("returns null when cross residual line would be null", () => {
    expect(
      formatWorldTileIntelEtaCrossResidualDeepLine(
        [],
        { x: 1, y: 2 },
        { march_id: 1, to_x: 9, to_y: 9 },
        now,
      ),
    ).toBeNull();
  });

  it("builds consolidation third line when coords match", () => {
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
    const line = formatWorldTileIntelEtaCrossResidualDeepLine(
      marches,
      { x: 4, y: 5 },
      marches[0],
      now,
    );
    expect(line).toContain("巩固对照");
    expect(line).toContain("#5");
    expect(line).toContain("只读对照");
  });
});

describe("pulseWorldTileIntelEtaCrossResidualDeepReadonly (CLIENT-268)", () => {
  afterEach(() => {
    resetWorldTileIntelEtaCrossResidualDeepTimersForTests(
      createWorldTileIntelEtaCrossResidualDeepTimers(),
    );
  });

  it("pulses deep third line and keeps CLIENT-252 cross pulse on cross row", () => {
    vi.useFakeTimers();
    const worldCard = document.createElement("aside");
    worldCard.innerHTML = `
      <p data-role="world-tile-intel-eta-cross-residual-line"></p>
      <p data-role="world-tile-intel-eta-cross-residual-deep-line">deep</p>
    `;
    const intelRoot = document.createElement("div");
    intelRoot.innerHTML = `
      <p data-role="march-info-card-phase-eta-strip" class="${MARCH_INTEL_PHASE_ETA_STRIP_CLASS}">ETA</p>
    `;
    const crossTimers = createWorldTileIntelEtaCrossResidualTimers();
    const deepTimers = createWorldTileIntelEtaCrossResidualDeepTimers();
    const crossLine = worldCard.querySelector(
      '[data-role="world-tile-intel-eta-cross-residual-line"]',
    ) as HTMLElement;
    const deepLine = worldCard.querySelector(
      '[data-role="world-tile-intel-eta-cross-residual-deep-line"]',
    ) as HTMLElement;
    const strip = intelRoot.querySelector("p") as HTMLElement;

    pulseWorldTileIntelEtaCrossResidualDeepReadonly(worldCard, intelRoot, true, {
      timers: crossTimers,
      deepTimers,
    });
    expect(crossLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS)).toBe(
      true,
    );
    expect(deepLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_CLASS)).toBe(
      true,
    );
    expect(strip.classList.contains(MARCH_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS)).toBe(true);

    vi.advanceTimersByTime(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_MS);
    expect(crossLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS)).toBe(
      false,
    );
    expect(deepLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_CLASS)).toBe(
      true,
    );

    vi.advanceTimersByTime(
      WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_MS - WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_MS,
    );
    expect(deepLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_CLASS)).toBe(
      false,
    );
    vi.useRealTimers();
  });
});
