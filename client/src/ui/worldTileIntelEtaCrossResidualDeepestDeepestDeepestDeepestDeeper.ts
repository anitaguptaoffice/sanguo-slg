import { formatMarchIntelPhaseEtaStrip } from "@/net/marchIntelPhaseEtaStrip";
import type { MarchSummary } from "@/net/militaryFormat";
import type { WorldTileRef } from "@/ui/worldTileInfoCard";
import {
  formatWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperLine,
  pulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperReadonly,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
  type PulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperOptions,
  type WorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperTimers,
} from "@/ui/worldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeper";
import { worldTileIntelEtaResidualCoordsMatch } from "@/ui/worldTileIntelEtaResidual";

/** 格点信息卡：军情 ETA 只读对照巩固再加深五层第六行（CLIENT-380；CLIENT-364 第六行 **不退化**）。 */
export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_CLASS =
  "world-tile-intel-eta-cross-residual-deepest-deepest-deepest-deepest-deeper-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_ROLE =
  "world-tile-intel-eta-cross-residual-deepest-deepest-deepest-deepest-deeper-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS =
  "world-tile-intel-eta-cross-residual-deepest-deepest-deepest-deepest-deeper-pulse";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_MS = 1500;

export type WorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperTimers = {
  deepestDeepestDeepestDeepestDeeperPulseTimer: ReturnType<typeof setTimeout> | null;
};

export function createWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperTimers(): WorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperTimers {
  return { deepestDeepestDeepestDeepestDeeperPulseTimer: null };
}

/**
 * 选中军情目的格与格点一致时：在 CLIENT-364 巩固第六行之上输出 wave:59 巩固再加深五层第六行（无新 world RPC）。
 */
export function formatWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperLine(
  marches: MarchSummary[],
  tile: WorldTileRef,
  selectedMarch: MarchSummary | null | undefined,
  nowMs = Date.now(),
): string | null {
  const deepestDeepestDeepestDeeper = formatWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperLine(
    marches,
    tile,
    selectedMarch,
    nowMs,
  );
  if (!deepestDeepestDeepestDeeper || !selectedMarch) return null;
  if (!worldTileIntelEtaResidualCoordsMatch(tile, selectedMarch)) return null;
  const intelEta = formatMarchIntelPhaseEtaStrip(selectedMarch, nowMs);
  const marchId = selectedMarch.march_id ?? "?";
  return `巩固再加深五层 · 第六行 · 军情 #${marchId} ETA ${intelEta} · ${deepestDeepestDeepestDeeper}`;
}

function clearWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperPulse(
  worldTileCard: HTMLElement | null | undefined,
): void {
  worldTileCard
    ?.querySelector<HTMLElement>(
      `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_ROLE}"].${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS}`,
    )
    ?.classList.remove(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS);
  worldTileCard
    ?.querySelector<HTMLElement>(
      `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_ROLE}"]`,
    )
    ?.classList.remove(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS);
}

export type PulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperOptions =
  PulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperOptions & {
    deepestDeepestDeepestDeepestDeeperTimers?: WorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperTimers;
    deepestDeepestDeepestDeepestDeeperDurationMs?: number;
  };

/**
 * CLIENT-364 deepest-deepest-deepest-deeper 脉冲 **不退化**；wave:59 第六行 deepest-deepest-deepest-deepest-deeper line 1.5s 脉冲（CLIENT-380）。
 */
export function pulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperReadonly(
  worldTileCard: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  active: boolean,
  options?: PulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperOptions,
): void {
  pulseWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperReadonly(
    worldTileCard,
    intelRoot,
    active,
    options,
  );

  const deepestDeepestDeepestDeepestDeeperTimers = options?.deepestDeepestDeepestDeepestDeeperTimers;
  if (deepestDeepestDeepestDeepestDeeperTimers?.deepestDeepestDeepestDeepestDeeperPulseTimer) {
    clearTimeout(deepestDeepestDeepestDeepestDeepestDeeperTimers.deepestDeepestDeepestDeepestDeeperPulseTimer);
    deepestDeepestDeepestDeepestDeeperTimers.deepestDeepestDeepestDeepestDeeperPulseTimer = null;
  }
  clearWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperPulse(worldTileCard);
  if (!active || !worldTileCard) return;

  const deepestDeepestDeepestDeepestDeeperLine = worldTileCard.querySelector<HTMLElement>(
    `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_LINE_ROLE}"]`,
  );
  if (
    !deepestDeepestDeepestDeepestDeeperLine ||
    deepestDeepestDeepestDeepestDeeperLine.classList.contains("hidden")
  )
    return;

  deepestDeepestDeepestDeepestDeeperLine.classList.add(
    WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
  );
  void deepestDeepestDeepestDeepestDeeperLine.offsetWidth;
  if (
    deepestDeepestDeepestDeepestDeeperLine.classList.contains(
      WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_CLASS,
    )
  ) {
    /* CLIENT-364 deepest-deepest-deepest-deeper pulse 须并存于上一层第六行，deepest-deepest-deepest-deepest-deeper 行独立 class */
  }

  const duration =
    options?.deepestDeepestDeepestDeepestDeeperDurationMs ??
    WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_DEEPEST_DEEPER_PULSE_MS;
  if (deepestDeepestDeepestDeepestDeeperTimers && duration > 0) {
    deepestDeepestDeepestDeepestDeeperTimers.deepestDeepestDeepestDeepestDeeperPulseTimer = setTimeout(
      () => {
        deepestDeepestDeepestDeepestDeeperTimers.deepestDeepestDeepestDeepestDeeperPulseTimer = null;
        clearWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperPulse(worldTileCard);
      },
      duration,
    );
  }
}

/** @internal vitest */
export function resetWorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperTimersForTests(
  timers: WorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeepestDeeperTimers,
): void {
  if (timers.deepestDeepestDeepestDeepestDeeperPulseTimer) {
    clearTimeout(timers.deepestDeepestDeepestDeepestDeeperPulseTimer);
    timers.deepestDeepestDeepestDeepestDeeperPulseTimer = null;
  }
}

export type { WorldTileIntelEtaCrossResidualDeepestDeepestDeepestDeeperTimers };
