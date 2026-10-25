import { formatMarchIntelPhaseEtaStrip } from "@/net/marchIntelPhaseEtaStrip";
import type { MarchSummary } from "@/net/militaryFormat";
import type { WorldTileRef } from "@/ui/worldTileInfoCard";
import {
  formatWorldTileIntelEtaCrossResidualDeepestDeeperLine,
  pulseWorldTileIntelEtaCrossResidualDeepestDeeperReadonly,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS,
  type PulseWorldTileIntelEtaCrossResidualDeepestDeeperOptions,
  type WorldTileIntelEtaCrossResidualDeepestDeeperTimers,
} from "@/ui/worldTileIntelEtaCrossResidualDeepestDeeper";
import { worldTileIntelEtaResidualCoordsMatch } from "@/ui/worldTileIntelEtaResidual";

/** 格点信息卡：军情 ETA 只读对照巩固再加深三层第五行（CLIENT-332；CLIENT-316 第五行 **不退化**）。 */
export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_CLASS =
  "world-tile-intel-eta-cross-residual-deepest-deepest-deeper-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_ROLE =
  "world-tile-intel-eta-cross-residual-deepest-deepest-deeper-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS =
  "world-tile-intel-eta-cross-residual-deepest-deepest-deeper-pulse";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS = 1500;

export type WorldTileIntelEtaCrossResidualDeepestDeepestDeeperTimers = {
  deepestDeepestDeeperPulseTimer: ReturnType<typeof setTimeout> | null;
};

export function createWorldTileIntelEtaCrossResidualDeepestDeepestDeeperTimers(): WorldTileIntelEtaCrossResidualDeepestDeepestDeeperTimers {
  return { deepestDeepestDeeperPulseTimer: null };
}

/**
 * 选中军情目的格与格点一致时：在 CLIENT-316 巩固第五行之上输出巩固再加深三层第五行（无新 world RPC）。
 */
export function formatWorldTileIntelEtaCrossResidualDeepestDeepestDeeperLine(
  marches: MarchSummary[],
  tile: WorldTileRef,
  selectedMarch: MarchSummary | null | undefined,
  nowMs = Date.now(),
): string | null {
  const deepestDeeper = formatWorldTileIntelEtaCrossResidualDeepestDeeperLine(
    marches,
    tile,
    selectedMarch,
    nowMs,
  );
  if (!deepestDeeper || !selectedMarch) return null;
  if (!worldTileIntelEtaResidualCoordsMatch(tile, selectedMarch)) return null;
  const intelEta = formatMarchIntelPhaseEtaStrip(selectedMarch, nowMs);
  const marchId = selectedMarch.march_id ?? "?";
  return `巩固再加深三层 · 第五行 · 军情 #${marchId} ETA ${intelEta} · ${deepestDeeper}`;
}

function clearWorldTileIntelEtaCrossResidualDeepestDeepestDeeperPulse(
  worldTileCard: HTMLElement | null | undefined,
): void {
  worldTileCard
    ?.querySelector<HTMLElement>(
      `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_ROLE}"].${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS}`,
    )
    ?.classList.remove(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS);
  worldTileCard
    ?.querySelector<HTMLElement>(
      `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_ROLE}"]`,
    )
    ?.classList.remove(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS);
}

export type PulseWorldTileIntelEtaCrossResidualDeepestDeepestDeeperOptions =
  PulseWorldTileIntelEtaCrossResidualDeepestDeeperOptions & {
    deepestDeepestDeeperTimers?: WorldTileIntelEtaCrossResidualDeepestDeepestDeeperTimers;
    deepestDeepestDeeperDurationMs?: number;
  };

/**
 * CLIENT-316 deepest-deeper 脉冲 **不退化**；第五行 deepest-deepest-deeper line 1.5s 脉冲（CLIENT-332）。
 */
export function pulseWorldTileIntelEtaCrossResidualDeepestDeepestDeeperReadonly(
  worldTileCard: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  active: boolean,
  options?: PulseWorldTileIntelEtaCrossResidualDeepestDeepestDeeperOptions,
): void {
  pulseWorldTileIntelEtaCrossResidualDeepestDeeperReadonly(worldTileCard, intelRoot, active, options);

  const deepestDeepestDeeperTimers = options?.deepestDeepestDeeperTimers;
  if (deepestDeepestDeeperTimers?.deepestDeepestDeeperPulseTimer) {
    clearTimeout(deepestDeepestDeeperTimers.deepestDeepestDeeperPulseTimer);
    deepestDeepestDeeperTimers.deepestDeepestDeeperPulseTimer = null;
  }
  clearWorldTileIntelEtaCrossResidualDeepestDeepestDeeperPulse(worldTileCard);
  if (!active || !worldTileCard) return;

  const deepestDeepestDeeperLine = worldTileCard.querySelector<HTMLElement>(
    `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_LINE_ROLE}"]`,
  );
  if (!deepestDeepestDeeperLine || deepestDeepestDeeperLine.classList.contains("hidden")) return;

  deepestDeepestDeeperLine.classList.add(
    WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
  );
  void deepestDeepestDeeperLine.offsetWidth;
  if (
    deepestDeepestDeeperLine.classList.contains(
      WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPER_PULSE_CLASS,
    )
  ) {
    /* CLIENT-316 deepest-deeper pulse 须并存于上一层第五行，deepest-deepest-deeper 行独立 class */
  }

  const duration =
    options?.deepestDeepestDeeperDurationMs ??
    WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPER_PULSE_MS;
  if (deepestDeepestDeeperTimers && duration > 0) {
    deepestDeepestDeeperTimers.deepestDeepestDeeperPulseTimer = setTimeout(() => {
      deepestDeepestDeeperTimers.deepestDeepestDeeperPulseTimer = null;
      clearWorldTileIntelEtaCrossResidualDeepestDeepestDeeperPulse(worldTileCard);
    }, duration);
  }
}

/** @internal vitest */
export function resetWorldTileIntelEtaCrossResidualDeepestDeepestDeeperTimersForTests(
  timers: WorldTileIntelEtaCrossResidualDeepestDeepestDeeperTimers,
): void {
  if (timers.deepestDeepestDeeperPulseTimer) {
    clearTimeout(timers.deepestDeepestDeeperPulseTimer);
    timers.deepestDeepestDeeperPulseTimer = null;
  }
}

export type { WorldTileIntelEtaCrossResidualDeepestDeeperTimers };
