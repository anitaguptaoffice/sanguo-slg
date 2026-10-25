import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createWorldTileIntelEtaCrossResidualTimers,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_MS,
} from "@/ui/worldTileIntelEtaCrossResidual";
import {
  createWorldTileIntelEtaCrossResidualDeepTimers,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_MS,
} from "@/ui/worldTileIntelEtaCrossResidualDeep";
import {
  createWorldTileIntelEtaCrossResidualDeeperTimers,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPER_PULSE_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPER_PULSE_MS,
} from "@/ui/worldTileIntelEtaCrossResidualDeeper";
import {
  createWorldTileIntelEtaCrossResidualDeepestTimers,
  formatWorldTileIntelEtaCrossResidualDeepestLine,
  resetWorldTileIntelEtaCrossResidualDeepestTimersForTests,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_PULSE_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_PULSE_MS,
  pulseWorldTileIntelEtaCrossResidualDeepestReadonly,
} from "@/ui/worldTileIntelEtaCrossResidualDeepest";
import { MARCH_INTEL_PHASE_ETA_STRIP_CLASS } from "@/net/marchIntelPhaseEtaStrip";
import { MARCH_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS } from "@/ui/worldTileIntelEtaCrossResidual";

describe("formatWorldTileIntelEtaCrossResidualDeepestLine (CLIENT-300)", () => {
  const now = 1_700_000_000_000;

  it("returns null when residual deeper line would be null", () => {
    expect(
      formatWorldTileIntelEtaCrossResidualDeepestLine(
        [],
        { x: 1, y: 2 },
        { march_id: 1, to_x: 9, to_y: 9 },
        now,
      ),
    ).toBeNull();
  });

  it("builds consolidation fifth line when coords match", () => {
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
    const line = formatWorldTileIntelEtaCrossResidualDeepestLine(
      marches,
      { x: 4, y: 5 },
      marches[0],
      now,
    );
    expect(line).toContain("巩固再加深一层");
    expect(line).toContain("第五行");
    expect(line).toContain("#5");
    expect(line).toContain("巩固再加深");
    expect(line).toContain("第四行");
  });
});

describe("pulseWorldTileIntelEtaCrossResidualDeepestReadonly (CLIENT-300)", () => {
  afterEach(() => {
    resetWorldTileIntelEtaCrossResidualDeepestTimersForTests(
      createWorldTileIntelEtaCrossResidualDeepestTimers(),
    );
  });

  it("pulses deepest fifth line and keeps CLIENT-284 deeper pulse on fourth row", () => {
    vi.useFakeTimers();
    const worldCard = document.createElement("aside");
    worldCard.innerHTML = `
      <p data-role="world-tile-intel-eta-cross-residual-line"></p>
      <p data-role="world-tile-intel-eta-cross-residual-deep-line">deep</p>
      <p data-role="world-tile-intel-eta-cross-residual-deeper-line">deeper</p>
      <p data-role="world-tile-intel-eta-cross-residual-deepest-line">deepest</p>
    `;
    const intelRoot = document.createElement("div");
    intelRoot.innerHTML = `
      <p data-role="march-info-card-phase-eta-strip" class="${MARCH_INTEL_PHASE_ETA_STRIP_CLASS}">ETA</p>
    `;
    const crossTimers = createWorldTileIntelEtaCrossResidualTimers();
    const deepTimers = createWorldTileIntelEtaCrossResidualDeepTimers();
    const deeperTimers = createWorldTileIntelEtaCrossResidualDeeperTimers();
    const deepestTimers = createWorldTileIntelEtaCrossResidualDeepestTimers();
    const crossLine = worldCard.querySelector(
      '[data-role="world-tile-intel-eta-cross-residual-line"]',
    ) as HTMLElement;
    const deepLine = worldCard.querySelector(
      '[data-role="world-tile-intel-eta-cross-residual-deep-line"]',
    ) as HTMLElement;
    const deeperLine = worldCard.querySelector(
      '[data-role="world-tile-intel-eta-cross-residual-deeper-line"]',
    ) as HTMLElement;
    const deepestLine = worldCard.querySelector(
      '[data-role="world-tile-intel-eta-cross-residual-deepest-line"]',
    ) as HTMLElement;
    const strip = intelRoot.querySelector("p") as HTMLElement;

    pulseWorldTileIntelEtaCrossResidualDeepestReadonly(worldCard, intelRoot, true, {
      timers: crossTimers,
      deepTimers,
      deeperTimers,
      deepestTimers,
    });
    expect(crossLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS)).toBe(
      true,
    );
    expect(deepLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_CLASS)).toBe(
      true,
    );
    expect(
      deeperLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPER_PULSE_CLASS),
    ).toBe(true);
    expect(
      deepestLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_PULSE_CLASS),
    ).toBe(true);
    expect(strip.classList.contains(MARCH_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS)).toBe(true);

    vi.advanceTimersByTime(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_MS);
    expect(crossLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS)).toBe(
      false,
    );
    expect(deepLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_CLASS)).toBe(
      true,
    );
    expect(
      deeperLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPER_PULSE_CLASS),
    ).toBe(true);
    expect(
      deepestLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_PULSE_CLASS),
    ).toBe(true);

    vi.advanceTimersByTime(
      WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_MS - WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_MS,
    );
    expect(deepLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_CLASS)).toBe(
      false,
    );
    expect(
      deeperLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPER_PULSE_CLASS),
    ).toBe(false);
    expect(
      deepestLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_PULSE_CLASS),
    ).toBe(false);
    vi.useRealTimers();
  });
});
