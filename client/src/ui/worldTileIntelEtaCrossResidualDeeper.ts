import { formatMarchIntelPhaseEtaStrip } from "@/net/marchIntelPhaseEtaStrip";
import type { MarchSummary } from "@/net/militaryFormat";
import type { WorldTileRef } from "@/ui/worldTileInfoCard";
import {
  formatWorldTileIntelEtaCrossResidualDeepLine,
  pulseWorldTileIntelEtaCrossResidualDeepReadonly,
  WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_CLASS,
  type PulseWorldTileIntelEtaCrossResidualDeepOptions,
  type WorldTileIntelEtaCrossResidualDeepTimers,
} from "@/ui/worldTileIntelEtaCrossResidualDeep";
import { worldTileIntelEtaResidualCoordsMatch } from "@/ui/worldTileIntelEtaResidual";

/** 格点信息卡：军情 ETA 只读对照巩固再加深第四行（CLIENT-284；CLIENT-268 第三行 **不退化**）。 */
export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPER_LINE_CLASS =
  "world-tile-intel-eta-cross-residual-deeper-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPER_LINE_ROLE =
  "world-tile-intel-eta-cross-residual-deeper-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPER_PULSE_CLASS =
  "world-tile-intel-eta-cross-residual-deeper-pulse";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPER_PULSE_MS = 1500;

export type WorldTileIntelEtaCrossResidualDeeperTimers = {
  deeperPulseTimer: ReturnType<typeof setTimeout> | null;
};

export function createWorldTileIntelEtaCrossResidualDeeperTimers(): WorldTileIntelEtaCrossResidualDeeperTimers {
  return { deeperPulseTimer: null };
}

/**
 * 选中军情目的格与格点一致时：在 CLIENT-268 巩固第三行之上输出巩固再加深第四行（无新 world RPC）。
 */
export function formatWorldTileIntelEtaCrossResidualDeeperLine(
  marches: MarchSummary[],
  tile: WorldTileRef,
  selectedMarch: MarchSummary | null | undefined,
  nowMs = Date.now(),
): string | null {
  const deep = formatWorldTileIntelEtaCrossResidualDeepLine(
    marches,
    tile,
    selectedMarch,
    nowMs,
  );
  if (!deep || !selectedMarch) return null;
  if (!worldTileIntelEtaResidualCoordsMatch(tile, selectedMarch)) return null;
  const intelEta = formatMarchIntelPhaseEtaStrip(selectedMarch, nowMs);
  const marchId = selectedMarch.march_id ?? "?";
  return `巩固再加深 · 第四行 · 军情 #${marchId} ETA ${intelEta} · ${deep}`;
}

function clearWorldTileIntelEtaCrossResidualDeeperPulse(
  worldTileCard: HTMLElement | null | undefined,
): void {
  worldTileCard
    ?.querySelector<HTMLElement>(
      `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPER_LINE_ROLE}"].${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPER_PULSE_CLASS}`,
    )
    ?.classList.remove(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPER_PULSE_CLASS);
  worldTileCard
    ?.querySelector<HTMLElement>(
      `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPER_LINE_ROLE}"]`,
    )
    ?.classList.remove(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPER_PULSE_CLASS);
}

export type PulseWorldTileIntelEtaCrossResidualDeeperOptions =
  PulseWorldTileIntelEtaCrossResidualDeepOptions & {
    deeperTimers?: WorldTileIntelEtaCrossResidualDeeperTimers;
    deeperDurationMs?: number;
  };

/**
 * CLIENT-268 deep 脉冲 **不退化**；第四行 deeper line 1.5s 脉冲（CLIENT-284）。
 */
export function pulseWorldTileIntelEtaCrossResidualDeeperReadonly(
  worldTileCard: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  active: boolean,
  options?: PulseWorldTileIntelEtaCrossResidualDeeperOptions,
): void {
  pulseWorldTileIntelEtaCrossResidualDeepReadonly(worldTileCard, intelRoot, active, options);

  const deeperTimers = options?.deeperTimers;
  if (deeperTimers?.deeperPulseTimer) {
    clearTimeout(deeperTimers.deeperPulseTimer);
    deeperTimers.deeperPulseTimer = null;
  }
  clearWorldTileIntelEtaCrossResidualDeeperPulse(worldTileCard);
  if (!active || !worldTileCard) return;

  const deeperLine = worldTileCard.querySelector<HTMLElement>(
    `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPER_LINE_ROLE}"]`,
  );
  if (!deeperLine || deeperLine.classList.contains("hidden")) return;

  deeperLine.classList.add(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPER_PULSE_CLASS);
  void deeperLine.offsetWidth;
  if (deeperLine.classList.contains(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEP_PULSE_CLASS)) {
    /* CLIENT-268 deep pulse 须并存于第三行，deeper 行独立 class */
  }

  const duration = options?.deeperDurationMs ?? WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_DEEPER_PULSE_MS;
  if (deeperTimers && duration > 0) {
    deeperTimers.deeperPulseTimer = setTimeout(() => {
      deeperTimers.deeperPulseTimer = null;
      clearWorldTileIntelEtaCrossResidualDeeperPulse(worldTileCard);
    }, duration);
  }
}

/** @internal vitest */
export function resetWorldTileIntelEtaCrossResidualDeeperTimersForTests(
  timers: WorldTileIntelEtaCrossResidualDeeperTimers,
): void {
  if (timers.deeperPulseTimer) {
    clearTimeout(timers.deeperPulseTimer);
    timers.deeperPulseTimer = null;
  }
}

export type { WorldTileIntelEtaCrossResidualDeepTimers };
