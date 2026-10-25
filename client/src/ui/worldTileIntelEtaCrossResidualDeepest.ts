import { formatMarchIntelPhaseEtaStrip } from "@/net/marchIntelPhaseEtaStrip";
import type { MarchSummary } from "@/net/militaryFormat";
import type { WorldTileRef } from "@/ui/worldTileInfoCard";
import {
  formatWorldTileIntelEtaCrossResidualDeeperLine,
  pulseWorldTileIntelEtaCrossResidualDeeperReadonly,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPER_PULSE_CLASS,
  type PulseWorldTileIntelEtaCrossResidualDeeperOptions,
  type WorldTileIntelEtaCrossResidualDeeperTimers,
} from "@/ui/worldTileIntelEtaCrossResidualDeeper";
import { worldTileIntelEtaResidualCoordsMatch } from "@/ui/worldTileIntelEtaResidual";

/** 格点信息卡：军情 ETA 只读对照巩固再加深一层第五行（CLIENT-300；CLIENT-284 第四行 **不退化**）。 */
export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_LINE_CLASS =
  "world-tile-intel-eta-cross-residual-deepest-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_LINE_ROLE =
  "world-tile-intel-eta-cross-residual-deepest-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_PULSE_CLASS =
  "world-tile-intel-eta-cross-residual-deepest-pulse";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_PULSE_MS = 1500;

export type WorldTileIntelEtaCrossResidualDeepestTimers = {
  deepestPulseTimer: ReturnType<typeof setTimeout> | null;
};

export function createWorldTileIntelEtaCrossResidualDeepestTimers(): WorldTileIntelEtaCrossResidualDeepestTimers {
  return { deepestPulseTimer: null };
}

/**
 * 选中军情目的格与格点一致时：在 CLIENT-284 巩固第四行之上输出巩固再加深一层第五行（无新 world RPC）。
 */
export function formatWorldTileIntelEtaCrossResidualDeepestLine(
  marches: MarchSummary[],
  tile: WorldTileRef,
  selectedMarch: MarchSummary | null | undefined,
  nowMs = Date.now(),
): string | null {
  const deeper = formatWorldTileIntelEtaCrossResidualDeeperLine(
    marches,
    tile,
    selectedMarch,
    nowMs,
  );
  if (!deeper || !selectedMarch) return null;
  if (!worldTileIntelEtaResidualCoordsMatch(tile, selectedMarch)) return null;
  const intelEta = formatMarchIntelPhaseEtaStrip(selectedMarch, nowMs);
  const marchId = selectedMarch.march_id ?? "?";
  return `巩固再加深一层 · 第五行 · 军情 #${marchId} ETA ${intelEta} · ${deeper}`;
}

function clearWorldTileIntelEtaCrossResidualDeepestPulse(
  worldTileCard: HTMLElement | null | undefined,
): void {
  worldTileCard
    ?.querySelector<HTMLElement>(
      `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_LINE_ROLE}"].${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_PULSE_CLASS}`,
    )
    ?.classList.remove(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_PULSE_CLASS);
  worldTileCard
    ?.querySelector<HTMLElement>(
      `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_LINE_ROLE}"]`,
    )
    ?.classList.remove(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_PULSE_CLASS);
}

export type PulseWorldTileIntelEtaCrossResidualDeepestOptions =
  PulseWorldTileIntelEtaCrossResidualDeeperOptions & {
    deepestTimers?: WorldTileIntelEtaCrossResidualDeepestTimers;
    deepestDurationMs?: number;
  };

/**
 * CLIENT-284 deeper 脉冲 **不退化**；第五行 deepest line 1.5s 脉冲（CLIENT-300）。
 */
export function pulseWorldTileIntelEtaCrossResidualDeepestReadonly(
  worldTileCard: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  active: boolean,
  options?: PulseWorldTileIntelEtaCrossResidualDeepestOptions,
): void {
  pulseWorldTileIntelEtaCrossResidualDeeperReadonly(worldTileCard, intelRoot, active, options);

  const deepestTimers = options?.deepestTimers;
  if (deepestTimers?.deepestPulseTimer) {
    clearTimeout(deepestTimers.deepestPulseTimer);
    deepestTimers.deepestPulseTimer = null;
  }
  clearWorldTileIntelEtaCrossResidualDeepestPulse(worldTileCard);
  if (!active || !worldTileCard) return;

  const deepestLine = worldTileCard.querySelector<HTMLElement>(
    `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_LINE_ROLE}"]`,
  );
  if (!deepestLine || deepestLine.classList.contains("hidden")) return;

  deepestLine.classList.add(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_PULSE_CLASS);
  void deepestLine.offsetWidth;
  if (deepestLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPER_PULSE_CLASS)) {
    /* CLIENT-284 deeper pulse 须并存于第四行，deepest 行独立 class */
  }

  const duration = options?.deepestDurationMs ?? WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_PULSE_MS;
  if (deepestTimers && duration > 0) {
    deepestTimers.deepestPulseTimer = setTimeout(() => {
      deepestTimers.deepestPulseTimer = null;
      clearWorldTileIntelEtaCrossResidualDeepestPulse(worldTileCard);
    }, duration);
  }
}

/** @internal vitest */
export function resetWorldTileIntelEtaCrossResidualDeepestTimersForTests(
  timers: WorldTileIntelEtaCrossResidualDeepestTimers,
): void {
  if (timers.deepestPulseTimer) {
    clearTimeout(timers.deepestPulseTimer);
    timers.deepestPulseTimer = null;
  }
}

export type { WorldTileIntelEtaCrossResidualDeeperTimers };
