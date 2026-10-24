import {
  formatMarchIntelPhaseEtaStrip,
  MARCH_INTEL_PHASE_ETA_STRIP_CLASS,
  MARCH_INTEL_PHASE_ETA_STRIP_ROLE,
} from "@/net/marchIntelPhaseEtaStrip";
import type { MarchSummary } from "@/net/militaryFormat";
import { findMostRecentInProgressMarchAtTile } from "@/ui/minimapMarchStack";
import type { WorldTileRef } from "@/ui/worldTileInfoCard";
import {
  formatWorldTileIntelEtaResidualLine,
  worldTileIntelEtaResidualCoordsMatch,
} from "@/ui/worldTileIntelEtaResidual";

/** 格点信息卡：军情 ETA 只读对照残余次行（CLIENT-252；CLIENT-237 顶栏 residual **不退化**）。 */
export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_LINE_CLASS =
  "world-tile-intel-eta-cross-residual-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_LINE_ROLE =
  "world-tile-intel-eta-cross-residual-line";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS =
  "world-tile-intel-eta-cross-residual-pulse";

/** 军情信息卡 phase/ETA 条只读对照脉冲（CLIENT-252）。 */
export const MARCH_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS =
  "march-intel-eta-cross-residual-pulse";

export const WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_MS = 1200;

export type WorldTileIntelEtaCrossResidualTimers = {
  pulseTimer: ReturnType<typeof setTimeout> | null;
};

export function createWorldTileIntelEtaCrossResidualTimers(): WorldTileIntelEtaCrossResidualTimers {
  return { pulseTimer: null };
}

/**
 * 选中军情目的格与格点一致时：格点 residual 与军情 ETA 条只读对照文案（无新 world RPC）。
 */
export function formatWorldTileIntelEtaCrossResidualLine(
  marches: MarchSummary[],
  tile: WorldTileRef,
  selectedMarch: MarchSummary | null | undefined,
  nowMs = Date.now(),
): string | null {
  if (!selectedMarch || !worldTileIntelEtaResidualCoordsMatch(tile, selectedMarch)) {
    return null;
  }
  const intelEta = formatMarchIntelPhaseEtaStrip(selectedMarch, nowMs);
  const marchId = selectedMarch.march_id ?? "?";
  const recent = findMostRecentInProgressMarchAtTile(marches, tile.x, tile.y);
  const tileResidual = formatWorldTileIntelEtaResidualLine(marches, tile, nowMs);
  if (recent?.march_id != null && recent.march_id === selectedMarch.march_id) {
    return `只读对照 · 格点军情与选中 #${marchId} ETA 同源 · ${intelEta}`;
  }
  const tileEta = recent ? formatMarchIntelPhaseEtaStrip(recent, nowMs) : "格点无进行中军情";
  return `只读对照 · ${tileResidual} ↔ 军情 #${marchId} · ${intelEta}（${tileEta}）`;
}

function clearWorldTileIntelEtaCrossResidualPulse(
  worldTileCard: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
): void {
  worldTileCard
    ?.querySelector<HTMLElement>(
      `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_LINE_ROLE}"].${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS}`,
    )
    ?.classList.remove(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS);
  worldTileCard
    ?.querySelector<HTMLElement>(
      `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_LINE_ROLE}"]`,
    )
    ?.classList.remove(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS);
  intelRoot
    ?.querySelector<HTMLElement>(
      `[data-role="${MARCH_INTEL_PHASE_ETA_STRIP_ROLE}"].${MARCH_INTEL_PHASE_ETA_STRIP_CLASS}.${MARCH_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS}`,
    )
    ?.classList.remove(MARCH_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS);
}

export type PulseWorldTileIntelEtaCrossResidualOptions = {
  durationMs?: number;
  timers?: WorldTileIntelEtaCrossResidualTimers;
};

/** 格点 cross residual 次行与军情 ETA 条 1.2s 只读对照脉冲（CLIENT-237 mutual ring 不退化）。 */
export function pulseWorldTileIntelEtaCrossResidualReadonly(
  worldTileCard: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  active: boolean,
  options?: PulseWorldTileIntelEtaCrossResidualOptions,
): void {
  const timers = options?.timers;
  if (timers?.pulseTimer) {
    clearTimeout(timers.pulseTimer);
    timers.pulseTimer = null;
  }
  clearWorldTileIntelEtaCrossResidualPulse(worldTileCard, intelRoot);
  if (!active || !worldTileCard || !intelRoot) return;

  const crossLine = worldTileCard.querySelector<HTMLElement>(
    `[data-role="${WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_LINE_ROLE}"]`,
  );
  crossLine?.classList.add(WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS);
  void crossLine?.offsetWidth;
  intelRoot
    .querySelector<HTMLElement>(
      `[data-role="${MARCH_INTEL_PHASE_ETA_STRIP_ROLE}"].${MARCH_INTEL_PHASE_ETA_STRIP_CLASS}`,
    )
    ?.classList.add(MARCH_INTEL_ETA_CROSS_RESIDUAL_PULSE_CLASS);

  const duration = options?.durationMs ?? WORLD_TILE_INTEL_ETA_CROSS_RESIDUAL_PULSE_MS;
  if (timers && duration > 0) {
    timers.pulseTimer = setTimeout(() => {
      timers.pulseTimer = null;
      clearWorldTileIntelEtaCrossResidualPulse(worldTileCard, intelRoot);
    }, duration);
  }
}

/** @internal vitest */
export function resetWorldTileIntelEtaCrossResidualTimersForTests(
  timers: WorldTileIntelEtaCrossResidualTimers,
): void {
  if (timers.pulseTimer) {
    clearTimeout(timers.pulseTimer);
    timers.pulseTimer = null;
  }
}
