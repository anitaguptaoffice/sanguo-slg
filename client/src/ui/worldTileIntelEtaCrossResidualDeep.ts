import { formatMarchIntelPhaseEtaStrip } from "@/net/marchIntelPhaseEtaStrip";
import type { MarchSummary } from "@/net/militaryFormat";
import type { WorldTileRef } from "@/ui/worldTileInfoCard";
import {
  formatWorldTileIntelEtaCrossResidualLine,
  pulseWorldTileIntelEtaCrossResidualReadonly,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS,
  type PulseWorldTileIntelEtaCrossResidualOptions,
  type WorldTileIntelEtaCrossResidualTimers,
} from "@/ui/worldTileIntelEtaCrossResidual";
import { worldTileIntelEtaResidualCoordsMatch } from "@/ui/worldTileIntelEtaResidual";

/** 格点信息卡：军情 ETA 只读对照巩固第三行（CLIENT-268；CLIENT-252 cross 次行 **不退化**）。 */
export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_LINE_CLASS =
  "world-tile-intel-eta-cross-residual-deep-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_LINE_ROLE =
  "world-tile-intel-eta-cross-residual-deep-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_CLASS =
  "world-tile-intel-eta-cross-residual-deep-pulse";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_MS = 1500;

export type WorldTileIntelEtaCrossResidualDeepTimers = {
  deepPulseTimer: ReturnType<typeof setTimeout> | null;
};

export function createWorldTileIntelEtaCrossResidualDeepTimers(): WorldTileIntelEtaCrossResidualDeepTimers {
  return { deepPulseTimer: null };
}

/**
 * 选中军情目的格与格点一致时：在 CLIENT-252 cross 次行之上输出巩固第三行（无新 world RPC）。
 */
export function formatWorldTileIntelEtaCrossResidualDeepLine(
  marches: MarchSummary[],
  tile: WorldTileRef,
  selectedMarch: MarchSummary | null | undefined,
  nowMs = Date.now(),
): string | null {
  const cross = formatWorldTileIntelEtaCrossResidualLine(
    marches,
    tile,
    selectedMarch,
    nowMs,
  );
  if (!cross || !selectedMarch) return null;
  if (!worldTileIntelEtaResidualCoordsMatch(tile, selectedMarch)) return null;
  const intelEta = formatMarchIntelPhaseEtaStrip(selectedMarch, nowMs);
  const marchId = selectedMarch.march_id ?? "?";
  return `巩固对照 · 军情 #${marchId} ETA ${intelEta} · ${cross}`;
}

function clearWorldTileIntelEtaCrossResidualDeepPulse(
  worldTileCard: HTMLElement | null | undefined,
): void {
  worldTileCard
    ?.querySelector<HTMLElement>(
      `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_LINE_ROLE}"].${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_CLASS}`,
    )
    ?.classList.remove(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_CLASS);
  worldTileCard
    ?.querySelector<HTMLElement>(
      `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_LINE_ROLE}"]`,
    )
    ?.classList.remove(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_CLASS);
}

export type PulseWorldTileIntelEtaCrossResidualDeepOptions =
  PulseWorldTileIntelEtaCrossResidualOptions & {
    deepTimers?: WorldTileIntelEtaCrossResidualDeepTimers;
    deepDurationMs?: number;
  };

/**
 * CLIENT-252 cross 脉冲 **不退化**；第三行 deep line 1.5s 脉冲（CLIENT-268）。
 */
export function pulseWorldTileIntelEtaCrossResidualDeepReadonly(
  worldTileCard: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  active: boolean,
  options?: PulseWorldTileIntelEtaCrossResidualDeepOptions,
): void {
  pulseWorldTileIntelEtaCrossResidualReadonly(worldTileCard, intelRoot, active, options);

  const deepTimers = options?.deepTimers;
  if (deepTimers?.deepPulseTimer) {
    clearTimeout(deepTimers.deepPulseTimer);
    deepTimers.deepPulseTimer = null;
  }
  clearWorldTileIntelEtaCrossResidualDeepPulse(worldTileCard);
  if (!active || !worldTileCard) return;

  const deepLine = worldTileCard.querySelector<HTMLElement>(
    `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_LINE_ROLE}"]`,
  );
  if (!deepLine || deepLine.classList.contains("hidden")) return;

  deepLine.classList.add(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_CLASS);
  void deepLine.offsetWidth;
  if (deepLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS)) {
    /* CLIENT-252 cross pulse 须并存于 cross 次行，deep 行独立 class */
  }

  const duration = options?.deepDurationMs ?? WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_MS;
  if (deepTimers && duration > 0) {
    deepTimers.deepPulseTimer = setTimeout(() => {
      deepTimers.deepPulseTimer = null;
      clearWorldTileIntelEtaCrossResidualDeepPulse(worldTileCard);
    }, duration);
  }
}

/** @internal vitest */
export function resetWorldTileIntelEtaCrossResidualDeepTimersForTests(
  timers: WorldTileIntelEtaCrossResidualDeepTimers,
): void {
  if (timers.deepPulseTimer) {
    clearTimeout(timers.deepPulseTimer);
    timers.deepPulseTimer = null;
  }
}

export type { WorldTileIntelEtaCrossResidualTimers };
