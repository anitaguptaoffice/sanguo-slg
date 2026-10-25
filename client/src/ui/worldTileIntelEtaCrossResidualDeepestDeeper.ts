import { formatMarchIntelPhaseEtaStrip } from "@/net/marchIntelPhaseEtaStrip";
import type { MarchSummary } from "@/net/militaryFormat";
import type { WorldTileRef } from "@/ui/worldTileInfoCard";
import {
  formatWorldTileIntelEtaCrossResidualDeepestLine,
  pulseWorldTileIntelEtaCrossResidualDeepestReadonly,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_PULSE_CLASS,
  type PulseWorldTileIntelEtaCrossResidualDeepestOptions,
  type WorldTileIntelEtaCrossResidualDeepestTimers,
} from "@/ui/worldTileIntelEtaCrossResidualDeepest";
import { worldTileIntelEtaResidualCoordsMatch } from "@/ui/worldTileIntelEtaResidual";

/** 格点信息卡：军情 ETA 只读对照巩固再加深二层第五行（CLIENT-316；CLIENT-300 第五行 **不退化**）。 */
export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_LINE_CLASS =
  "world-tile-intel-eta-cross-residual-deepest-deeper-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_LINE_ROLE =
  "world-tile-intel-eta-cross-residual-deepest-deeper-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS =
  "world-tile-intel-eta-cross-residual-deepest-deeper-pulse";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_PULSE_MS = 1500;

export type WorldTileIntelEtaCrossResidualDeepestDeeperTimers = {
  deepestDeeperPulseTimer: ReturnType<typeof setTimeout> | null;
};

export function createWorldTileIntelEtaCrossResidualDeepestDeeperTimers(): WorldTileIntelEtaCrossResidualDeepestDeeperTimers {
  return { deepestDeeperPulseTimer: null };
}

/**
 * 选中军情目的格与格点一致时：在 CLIENT-300 巩固第五行之上输出巩固再加深二层第五行（无新 world RPC）。
 */
export function formatWorldTileIntelEtaCrossResidualDeepestDeeperLine(
  marches: MarchSummary[],
  tile: WorldTileRef,
  selectedMarch: MarchSummary | null | undefined,
  nowMs = Date.now(),
): string | null {
  const deepest = formatWorldTileIntelEtaCrossResidualDeepestLine(
    marches,
    tile,
    selectedMarch,
    nowMs,
  );
  if (!deepest || !selectedMarch) return null;
  if (!worldTileIntelEtaResidualCoordsMatch(tile, selectedMarch)) return null;
  const intelEta = formatMarchIntelPhaseEtaStrip(selectedMarch, nowMs);
  const marchId = selectedMarch.march_id ?? "?";
  return `巩固再加深二层 · 第五行 · 军情 #${marchId} ETA ${intelEta} · ${deepest}`;
}

function clearWorldTileIntelEtaCrossResidualDeepestDeeperPulse(
  worldTileCard: HTMLElement | null | undefined,
): void {
  worldTileCard
    ?.querySelector<HTMLElement>(
      `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_LINE_ROLE}"].${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS}`,
    )
    ?.classList.remove(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS);
  worldTileCard
    ?.querySelector<HTMLElement>(
      `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_LINE_ROLE}"]`,
    )
    ?.classList.remove(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS);
}

export type PulseWorldTileIntelEtaCrossResidualDeepestDeeperOptions =
  PulseWorldTileIntelEtaCrossResidualDeepestOptions & {
    deepestDeeperTimers?: WorldTileIntelEtaCrossResidualDeepestDeeperTimers;
    deepestDeeperDurationMs?: number;
  };

/**
 * CLIENT-300 deepest 脉冲 **不退化**；第五行 deepest-deeper line 1.5s 脉冲（CLIENT-316）。
 */
export function pulseWorldTileIntelEtaCrossResidualDeepestDeeperReadonly(
  worldTileCard: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  active: boolean,
  options?: PulseWorldTileIntelEtaCrossResidualDeepestDeeperOptions,
): void {
  pulseWorldTileIntelEtaCrossResidualDeepestReadonly(worldTileCard, intelRoot, active, options);

  const deepestDeeperTimers = options?.deepestDeeperTimers;
  if (deepestDeeperTimers?.deepestDeeperPulseTimer) {
    clearTimeout(deepestDeeperTimers.deepestDeeperPulseTimer);
    deepestDeeperTimers.deepestDeeperPulseTimer = null;
  }
  clearWorldTileIntelEtaCrossResidualDeepestDeeperPulse(worldTileCard);
  if (!active || !worldTileCard) return;

  const deepestDeeperLine = worldTileCard.querySelector<HTMLElement>(
    `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_LINE_ROLE}"]`,
  );
  if (!deepestDeeperLine || deepestDeeperLine.classList.contains("hidden")) return;

  deepestDeeperLine.classList.add(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS);
  void deepestDeeperLine.offsetWidth;
  if (deepestDeeperLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_PULSE_CLASS)) {
    /* CLIENT-300 deepest pulse 须并存于上一层第五行，deepest-deeper 行独立 class */
  }

  const duration =
    options?.deepestDeeperDurationMs ?? WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_PULSE_MS;
  if (deepestDeeperTimers && duration > 0) {
    deepestDeeperTimers.deepestDeeperPulseTimer = setTimeout(() => {
      deepestDeeperTimers.deepestDeeperPulseTimer = null;
      clearWorldTileIntelEtaCrossResidualDeepestDeeperPulse(worldTileCard);
    }, duration);
  }
}

/** @internal vitest */
export function resetWorldTileIntelEtaCrossResidualDeepestDeeperTimersForTests(
  timers: WorldTileIntelEtaCrossResidualDeepestDeeperTimers,
): void {
  if (timers.deepestDeeperPulseTimer) {
    clearTimeout(timers.deepestDeeperPulseTimer);
    timers.deepestDeeperPulseTimer = null;
  }
}

export type { WorldTileIntelEtaCrossResidualDeepestTimers };
