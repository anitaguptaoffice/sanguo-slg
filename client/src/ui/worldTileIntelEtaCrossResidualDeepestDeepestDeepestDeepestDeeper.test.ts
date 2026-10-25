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
} from "@/ui/worldTileIntelEtaCrossResidualDeeper";
import {
  createWorldTileIntelEtaCrossResidualDeepestTimers,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_PULSE_CLASS,
} from "@/ui/worldTileIntelEtaCrossResidualDeepest";
import {
  createWorldTileIntelEtaCrossResidualDeepestDeeperTimers,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS,
} from "@/ui/worldTileIntelEtaCrossResidualDeepestDeeper";
import {
  createWorldTileIntelEtaCrossResidualDeepestDeepestDeeperTimers,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
} from "@/ui/worldTileIntelEtaCrossResidualDeepestDeepestDeeper";
import {
  createWorldTileIntelEtaCrossResidualDeepestDeepestDeepestTimers,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS,
} from "@/ui/worldTileIntelEtaCrossResidualDeepestDeepestDeepest";
import {
  createWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperTimers,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
} from "@/ui/worldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeper";
import {
  createWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperTimers,
  formatWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperLine,
  resetWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperTimersForTests,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_MS,
  pulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperReadonly,
} from "@/ui/worldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeper";
import { MARCH_INTEL_PHASE_ETA_STRIP_CLASS } from "@/net/marchIntelPhaseEtaStrip";
import { MARCH_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS } from "@/ui/worldTileIntelEtaCrossResidual";

describe("formatWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperLine (CLIENT-380)", () => {
  const now = 1_700_000_000_000;

  it("returns null when residual deepest-deepest-deepest-deeper line would be null", () => {
    expect(
      formatWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperLine(
        [],
        { x: 1, y: 2 },
        { march_id: 1, to_x: 9, to_y: 9 },
        now,
      ),
    ).toBeNull();
  });

  it("builds consolidation sixth line when coords match", () => {
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
    const line = formatWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperLine(
      marches,
      { x: 4, y: 5 },
      marches[0],
      now,
    );
    expect(line).toContain("巩固再加深五层");
    expect(line).toContain("第六行");
    expect(line).toContain("#5");
    expect(line).toContain("巩固再加深五层 · 第六行");
  });
});

describe("pulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperReadonly (CLIENT-380)", () => {
  afterEach(() => {
    resetWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperTimersForTests(
      createWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperTimers(),
    );
  });

  it("pulses deepest-deepest-deepest-deepest-deeper sixth line and keeps CLIENT-364 deepest-deepest-deepest-deeper pulse", () => {
    vi.useFakeTimers();
    const worldCard = document.createElement("aside");
    worldCard.innerHTML = `
      <p data-role="world-tile-intel-eta-cross-residual-line"></p>
      <p data-role="world-tile-intel-eta-cross-residual-deep-line">deep</p>
      <p data-role="world-tile-intel-eta-cross-residual-deeper-line">deeper</p>
      <p data-role="world-tile-intel-eta-cross-residual-deepest-line">deepest</p>
      <p data-role="world-tile-intel-eta-cross-residual-deepest-deeper-line">deepest-deeper</p>
      <p data-role="world-tile-intel-eta-cross-residual-deepest-deepest-deeper-line">deepest-deepest-deeper</p>
      <p data-role="world-tile-intel-eta-cross-residual-deepest-deepest-deepest-line">deepest-deepest-deepest</p>
      <p data-role="world-tile-intel-eta-cross-residual-deepest-deepest-deepest-deeper-line">deepest-deepest-deepest-deeper</p>
      <p data-role="world-tile-intel-eta-cross-residual-deepest-deepest-deepest-deepest-deeper-line">deepest-deepest-deepest-deepest-deeper</p>
    `;
    const intelRoot = document.createElement("div");
    intelRoot.innerHTML = `
      <p data-role="march-info-card-phase-eta-strip" class="${MARCH_INTEL_PHASE_ETA_STRIP_CLASS}">ETA</p>
    `;
    const crossTimers = createWorldTileIntelEtaCrossResidualTimers();
    const deepTimers = createWorldTileIntelEtaCrossResidualDeepTimers();
    const deeperTimers = createWorldTileIntelEtaCrossResidualDeeperTimers();
    const deepestTimers = createWorldTileIntelEtaCrossResidualDeepestTimers();
    const deepestDeeperTimers = createWorldTileIntelEtaCrossResidualDeepestDeeperTimers();
    const deepestDeepestDeeperTimers = createWorldTileIntelEtaCrossResidualDeepestDeepestDeeperTimers();
    const deepestDeepestDeepestTimers = createWorldTileIntelEtaCrossResidualDeepestDeepestDeepestTimers();
    const deepestDeepestDeepestDeeperTimers =
      createWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperTimers();
    const deepestDeepestDeepestDeepestDeeperTimers =
      createWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperTimers();
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
    const deepestDeeperLine = worldCard.querySelector(
      '[data-role="world-tile-intel-eta-cross-residual-deepest-deeper-line"]',
    ) as HTMLElement;
    const deepestDeepestDeeperLine = worldCard.querySelector(
      '[data-role="world-tile-intel-eta-cross-residual-deepest-deepest-deeper-line"]',
    ) as HTMLElement;
    const deepestDeepestDeepestLine = worldCard.querySelector(
      '[data-role="world-tile-intel-eta-cross-residual-deepest-deepest-deepest-line"]',
    ) as HTMLElement;
    const deepestDeepestDeepestDeeperLine = worldCard.querySelector(
      '[data-role="world-tile-intel-eta-cross-residual-deepest-deepest-deepest-deeper-line"]',
    ) as HTMLElement;
    const deepestDeepestDeepestDeepestDeeperLine = worldCard.querySelector(
      '[data-role="world-tile-intel-eta-cross-residual-deepest-deepest-deepest-deepest-deeper-line"]',
    ) as HTMLElement;
    const strip = intelRoot.querySelector("p") as HTMLElement;

    pulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperReadonly(
      worldCard,
      intelRoot,
      true,
      {
        timers: crossTimers,
        deepTimers,
        deeperTimers,
        deepestTimers,
        deepestDeeperTimers,
        deepestDeepestDeeperTimers,
        deepestDeepestDeepestTimers,
        deepestDeepestDeepestDeeperTimers,
        deepestDeepestDeepestDeepestDeeperTimers,
      },
    );
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
    expect(
      deepestDeeperLine.classList.contains(
        WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS,
      ),
    ).toBe(true);
    expect(
      deepestDeepestDeeperLine.classList.contains(
        WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
      ),
    ).toBe(true);
    expect(
      deepestDeepestDeepestLine.classList.contains(
        WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS,
      ),
    ).toBe(true);
    expect(
      deepestDeepestDeepestDeeperLine.classList.contains(
        WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
      ),
    ).toBe(true);
    expect(
      deepestDeepestDeepestDeepestDeeperLine.classList.contains(
        WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
      ),
    ).toBe(true);
    expect(strip.classList.contains(MARCH_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS)).toBe(true);

    vi.advanceTimersByTime(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_MS);
    expect(crossLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS)).toBe(
      false,
    );
    expect(
      deepestDeepestDeepestDeepestDeeperLine.classList.contains(
        WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
      ),
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
    expect(
      deepestDeeperLine.classList.contains(
        WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS,
      ),
    ).toBe(false);
    expect(
      deepestDeepestDeeperLine.classList.contains(
        WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
      ),
    ).toBe(false);
    expect(
      deepestDeepestDeepestLine.classList.contains(
        WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS,
      ),
    ).toBe(false);
    expect(
      deepestDeepestDeepestDeeperLine.classList.contains(
        WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
      ),
    ).toBe(false);
    expect(
      deepestDeepestDeepestDeepestDeeperLine.classList.contains(
        WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
      ),
    ).toBe(false);
    vi.useRealTimers();
  });
});
