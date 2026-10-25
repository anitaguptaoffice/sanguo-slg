import { formatMarchIntelPhaseEtaStrip } from "@/net/marchIntelPhaseEtaStrip";
import type { MarchSummary } from "@/net/militaryFormat";
import type { WorldTileRef } from "@/ui/worldTileInfoCard";
import {
  formatWorldTileIntelEtaCrossResidualDeepestDeepestDeeperLine,
  pulseWorldTileIntelEtaCrossResidualDeepestDeepestDeeperReadonly,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
  type PulseWorldTileIntelEtaCrossResidualDeepestDeepestDeeperOptions,
  type WorldTileIntelEtaCrossResidualDeepestDeepestDeeperTimers,
} from "@/ui/worldTileIntelEtaCrossResidualDeepestDeepestDeeper";
import { worldTileIntelEtaResidualCoordsMatch } from "@/ui/worldTileIntelEtaResidual";

/** 格点信息卡：军情 ETA 只读对照巩固再加深四层第五行（CLIENT-348；CLIENT-332 第五行 **不退化**）。 */
export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_CLASS =
  "world-tile-intel-eta-cross-residual-deepest-deepest-deepest-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_ROLE =
  "world-tile-intel-eta-cross-residual-deepest-deepest-deepest-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS =
  "world-tile-intel-eta-cross-residual-deepest-deepest-deepest-pulse";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_MS = 1500;

export type WorldTileIntelEtaCrossResidualDeepestDeepestDeepestTimers = {
  deepestDeepestDeepestPulseTimer: ReturnType<typeof setTimeout> | null;
};

export function createWorldTileIntelEtaCrossResidualDeepestDeepestDeepestTimers(): WorldTileIntelEtaCrossResidualDeepestDeepestDeepestTimers {
  return { deepestDeepestDeepestPulseTimer: null };
}

/**
 * 选中军情目的格与格点一致时：在 CLIENT-332 巩固第五行之上输出巩固再加深四层第五行（无新 world RPC）。
 */
export function formatWorldTileIntelEtaCrossResidualDeepestDeepestDeepestLine(
  marches: MarchSummary[],
  tile: WorldTileRef,
  selectedMarch: MarchSummary | null | undefined,
  nowMs = Date.now(),
): string | null {
  const deepestDeepestDeeper = formatWorldTileIntelEtaCrossResidualDeepestDeepestDeeperLine(
    marches,
    tile,
    selectedMarch,
    nowMs,
  );
  if (!deepestDeepestDeeper || !selectedMarch) return null;
  if (!worldTileIntelEtaResidualCoordsMatch(tile, selectedMarch)) return null;
  const intelEta = formatMarchIntelPhaseEtaStrip(selectedMarch, nowMs);
  const marchId = selectedMarch.march_id ?? "?";
  return `巩固再加深四层 · 第五行 · 军情 #${marchId} ETA ${intelEta} · ${deepestDeepestDeeper}`;
}

function clearWorldTileIntelEtaCrossResidualDeepestDeepestDeepestPulse(
  worldTileCard: HTMLElement | null | undefined,
): void {
  worldTileCard
    ?.querySelector<HTMLElement>(
      `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_ROLE}"].${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS}`,
    )
    ?.classList.remove(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS);
  worldTileCard
    ?.querySelector<HTMLElement>(
      `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_ROLE}"]`,
    )
    ?.classList.remove(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS);
}

export type PulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestOptions =
  PulseWorldTileIntelEtaCrossResidualDeepestDeepestDeeperOptions & {
    deepestDeepestDeepestTimers?: WorldTileIntelEtaCrossResidualDeepestDeepestDeepestTimers;
    deepestDeepestDeepestDurationMs?: number;
  };

/**
 * CLIENT-332 deepest-deepest-deeper 脉冲 **不退化**；第五行 deepest-deepest-deepest line 1.5s 脉冲（CLIENT-348）。
 */
export function pulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestReadonly(
  worldTileCard: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  active: boolean,
  options?: PulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestOptions,
): void {
  pulseWorldTileIntelEtaCrossResidualDeepestDeepestDeeperReadonly(
    worldTileCard,
    intelRoot,
    active,
    options,
  );

  const deepestDeepestDeepestTimers = options?.deepestDeepestDeepestTimers;
  if (deepestDeepestDeepestTimers?.deepestDeepestDeepestPulseTimer) {
    clearTimeout(deepestDeepestDeepestTimers.deepestDeepestDeepestPulseTimer);
    deepestDeepestDeepestTimers.deepestDeepestDeepestPulseTimer = null;
  }
  clearWorldTileIntelEtaCrossResidualDeepestDeepestDeepestPulse(worldTileCard);
  if (!active || !worldTileCard) return;

  const deepestDeepestDeepestLine = worldTileCard.querySelector<HTMLElement>(
    `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_LINE_ROLE}"]`,
  );
  if (!deepestDeepestDeepestLine || deepestDeepestDeepestLine.classList.contains("hidden")) return;

  deepestDeepestDeepestLine.classList.add(
    WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_CLASS,
  );
  void deepestDeepestDeepestLine.offsetWidth;
  if (
    deepestDeepestDeepestLine.classList.contains(
      WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
    )
  ) {
    /* CLIENT-332 deepest-deepest-deeper pulse 须并存于上一层第五行，deepest-deepest-deepest 行独立 class */
  }

  const duration =
    options?.deepestDeepestDeepestDurationMs ??
    WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_PULSE_MS;
  if (deepestDeepestDeepestTimers && duration > 0) {
    deepestDeepestDeepestTimers.deepestDeepestDeepestPulseTimer = setTimeout(() => {
      deepestDeepestDeepestTimers.deepestDeepestDeepestPulseTimer = null;
      clearWorldTileIntelEtaCrossResidualDeepestDeepestDeepestPulse(worldTileCard);
    }, duration);
  }
}

/** @internal vitest */
export function resetWorldTileIntelEtaCrossResidualDeepestDeepestDeepestTimersForTests(
  timers: WorldTileIntelEtaCrossResidualDeepestDeepestDeepestTimers,
): void {
  if (timers.deepestDeepestDeepestPulseTimer) {
    clearTimeout(timers.deepestDeepestDeepestPulseTimer);
    timers.deepestDeepestDeepestPulseTimer = null;
  }
}

export type { WorldTileIntelEtaCrossResidualDeepestDeepestDeeperTimers };
