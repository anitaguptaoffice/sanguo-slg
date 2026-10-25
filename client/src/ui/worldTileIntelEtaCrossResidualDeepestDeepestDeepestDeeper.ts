import { formatMarchIntelPhaseEtaStrip } from "@/net/marchIntelPhaseEtaStrip";
import type { MarchSummary } from "@/net/militaryFormat";
import type { WorldTileRef } from "@/ui/worldTileInfoCard";
import {
  formatWorldTileIntelEtaCrossResidualDeepestDeepestDeepestLine,
  pulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestReadonly,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS,
  type PulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestOptions,
  type WorldTileIntelEtaCrossResidualDeepestDeepestDeepestTimers,
} from "@/ui/worldTileIntelEtaCrossResidualDeepestDeepestDeepest";
import { worldTileIntelEtaResidualCoordsMatch } from "@/ui/worldTileIntelEtaResidual";

/** 格点信息卡：军情 ETA 只读对照巩固再加深五层第六行（CLIENT-364；CLIENT-348 第五行 **不退化**）。 */
export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_CLASS =
  "world-tile-intel-eta-cross-residual-deepest-deepest-deepest-deeper-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_ROLE =
  "world-tile-intel-eta-cross-residual-deepest-deepest-deepest-deeper-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS =
  "world-tile-intel-eta-cross-residual-deepest-deepest-deepest-deeper-pulse";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_MS = 1500;

export type WorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperTimers = {
  deepestDeepestDeepestDeeperPulseTimer: ReturnType<typeof setTimeout> | null;
};

export function createWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperTimers(): WorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperTimers {
  return { deepestDeepestDeepestDeeperPulseTimer: null };
}

/**
 * 选中军情目的格与格点一致时：在 CLIENT-348 巩固第五行之上输出巩固再加深五层第六行（无新 world RPC）。
 */
export function formatWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperLine(
  marches: MarchSummary[],
  tile: WorldTileRef,
  selectedMarch: MarchSummary | null | undefined,
  nowMs = Date.now(),
): string | null {
  const deepestDeepestDeepest = formatWorldTileIntelEtaCrossResidualDeepestDeepestDeepestLine(
    marches,
    tile,
    selectedMarch,
    nowMs,
  );
  if (!deepestDeepestDeepest || !selectedMarch) return null;
  if (!worldTileIntelEtaResidualCoordsMatch(tile, selectedMarch)) return null;
  const intelEta = formatMarchIntelPhaseEtaStrip(selectedMarch, nowMs);
  const marchId = selectedMarch.march_id ?? "?";
  return `巩固再加深五层 · 第六行 · 军情 #${marchId} ETA ${intelEta} · ${deepestDeepestDeepest}`;
}

function clearWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperPulse(
  worldTileCard: HTMLElement | null | undefined,
): void {
  worldTileCard
    ?.querySelector<HTMLElement>(
      `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_ROLE}"].${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS}`,
    )
    ?.classList.remove(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS);
  worldTileCard
    ?.querySelector<HTMLElement>(
      `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_ROLE}"]`,
    )
    ?.classList.remove(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS);
}

export type PulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperOptions =
  PulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestOptions & {
    deepestDeepestDeepestDeeperTimers?: WorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperTimers;
    deepestDeepestDeepestDeeperDurationMs?: number;
  };

/**
 * CLIENT-348 deepest-deepest-deepest 脉冲 **不退化**；第六行 deepest-deepest-deepest-deeper line 1.5s 脉冲（CLIENT-364）。
 */
export function pulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperReadonly(
  worldTileCard: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  active: boolean,
  options?: PulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperOptions,
): void {
  pulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestReadonly(
    worldTileCard,
    intelRoot,
    active,
    options,
  );

  const deepestDeepestDeepestDeeperTimers = options?.deepestDeepestDeepestDeeperTimers;
  if (deepestDeepestDeepestDeeperTimers?.deepestDeepestDeepestDeeperPulseTimer) {
    clearTimeout(deepestDeepestDeepestDeeperTimers.deepestDeepestDeepestDeeperPulseTimer);
    deepestDeepestDeepestDeeperTimers.deepestDeepestDeepestDeeperPulseTimer = null;
  }
  clearWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperPulse(worldTileCard);
  if (!active || !worldTileCard) return;

  const deepestDeepestDeepestDeeperLine = worldTileCard.querySelector<HTMLElement>(
    `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_ROLE}"]`,
  );
  if (!deepestDeepestDeepestDeeperLine || deepestDeepestDeepestDeeperLine.classList.contains("hidden"))
    return;

  deepestDeepestDeepestDeeperLine.classList.add(
    WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
  );
  void deepestDeepestDeepestDeeperLine.offsetWidth;
  if (
    deepestDeepestDeepestDeeperLine.classList.contains(
      WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS,
    )
  ) {
    /* CLIENT-348 deepest-deepest-deepest pulse 须并存于上一层第五行，deepest-deepest-deepest-deeper 行独立 class */
  }

  const duration =
    options?.deepestDeepestDeepestDeeperDurationMs ??
    WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_MS;
  if (deepestDeepestDeepestDeeperTimers && duration > 0) {
    deepestDeepestDeepestDeeperTimers.deepestDeepestDeepestDeeperPulseTimer = setTimeout(() => {
      deepestDeepestDeepestDeeperTimers.deepestDeepestDeepestDeeperPulseTimer = null;
      clearWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperPulse(worldTileCard);
    }, duration);
  }
}

/** @internal vitest */
export function resetWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperTimersForTests(
  timers: WorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperTimers,
): void {
  if (timers.deepestDeepestDeepestDeeperPulseTimer) {
    clearTimeout(timers.deepestDeepestDeepestDeeperPulseTimer);
    timers.deepestDeepestDeepestDeeperPulseTimer = null;
  }
}

export type { WorldTileIntelEtaCrossResidualDeepestDeepestDeepestTimers };
