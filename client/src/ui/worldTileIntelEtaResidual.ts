import { formatMarchIntelPhaseEtaStrip } from "@/net/marchIntelPhaseEtaStrip";
import type { MarchSummary } from "@/net/militaryFormat";
import { formatCityCoords } from "@/net/worldFormat";
import { findMostRecentInProgressMarchAtTile } from "@/ui/minimapMarchStack";
import type { WorldTileRef } from "@/ui/worldTileInfoCard";
import { gridCellsMatch } from "@/ui/marchWorldListLink";

/** 格点信息卡顶栏：军情 ETA 对照残余次行（CLIENT-237）。 */
export const WORLD_TILE_INTEL_ETA_RESIDUAL_LINE_CLASS = "world-tile-intel-eta-residual-line";

export const WORLD_TILE_INTEL_ETA_RESIDUAL_LINE_ROLE = "world-tile-intel-eta-residual-line";

/** 格点信息卡与军情信息卡互链 1s 焦点环（CLIENT-237）。 */
export const WORLD_TILE_INTEL_ETA_RESIDUAL_RING_CLASS = "world-tile-intel-eta-residual-ring";

/** 军情只读信息卡同源目的格坐标次行（CLIENT-237）。 */
export const MARCH_INTEL_ETA_RESIDUAL_COORD_CLASS = "march-intel-eta-residual-coord";

export const MARCH_INTEL_ETA_RESIDUAL_COORD_ROLE = "march-info-card-eta-residual-coord";

export const MARCH_INTEL_ETA_RESIDUAL_COORD_HIGHLIGHT_CLASS =
  "march-intel-eta-residual-coord-highlight";

export const WORLD_TILE_INTEL_ETA_RESIDUAL_RING_MS = 1000;

export const WORLD_TILE_INTEL_ETA_RESIDUAL_EMPTY_HINT =
  "暂无进行中军情 ETA 对照（可打开军情查看历史）";

export type WorldTileIntelEtaResidualTimers = {
  ringTimer: ReturnType<typeof setTimeout> | null;
};

export function createWorldTileIntelEtaResidualTimers(): WorldTileIntelEtaResidualTimers {
  return { ringTimer: null };
}

/** 军情信息卡只读目的格坐标次行（与格点信息卡 `data-grid-x/y` 同源）。 */
export function formatMarchIntelEtaResidualCoordLine(m: MarchSummary): string | null {
  const tx = m.to_x;
  const ty = m.to_y;
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return null;
  return `目的格 ${formatCityCoords(Math.trunc(tx!), Math.trunc(ty!))}`;
}

/**
 * 格点信息卡顶栏：坐标 + 最近终点行军 phase/ETA（ListMarches 只读；与 CLIENT-205 阶段条同源文案）。
 */
export function formatWorldTileIntelEtaResidualLine(
  marches: MarchSummary[],
  tile: WorldTileRef,
  nowMs = Date.now(),
): string {
  const coord = formatCityCoords(tile.x, tile.y);
  const recent = findMostRecentInProgressMarchAtTile(marches, tile.x, tile.y);
  if (!recent) {
    return `格点 ${coord} · ${WORLD_TILE_INTEL_ETA_RESIDUAL_EMPTY_HINT}`;
  }
  const phaseEta = formatMarchIntelPhaseEtaStrip(recent, nowMs);
  const id = recent.march_id ?? "?";
  return `格点 ${coord} · 军情 #${id} · ${phaseEta}`;
}

export function worldTileIntelEtaResidualCoordsMatch(
  grid: WorldTileRef | null | undefined,
  march: Pick<MarchSummary, "to_x" | "to_y"> | null | undefined,
): boolean {
  if (!grid || !march) return false;
  const tx = march.to_x;
  const ty = march.to_y;
  if (!Number.isFinite(tx) || !Number.isFinite(ty)) return false;
  return gridCellsMatch(grid.x, grid.y, tx!, ty!);
}

function clearWorldTileIntelEtaResidualHighlight(
  worldTileCard: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
): void {
  worldTileCard?.classList.remove(WORLD_TILE_INTEL_ETA_RESIDUAL_RING_CLASS);
  intelRoot
    ?.querySelector<HTMLElement>(
      `[data-role="${MARCH_INTEL_ETA_RESIDUAL_COORD_ROLE}"].${MARCH_INTEL_ETA_RESIDUAL_COORD_CLASS}`,
    )
    ?.classList.remove(MARCH_INTEL_ETA_RESIDUAL_COORD_HIGHLIGHT_CLASS);
}

export type PulseWorldTileIntelEtaResidualMutualHighlightOptions = {
  durationMs?: number;
  timers?: WorldTileIntelEtaResidualTimers;
};

/**
 * 同源目的格坐标：格点信息卡 `world-tile-intel-eta-residual-ring` 与军情信息卡坐标次行 1s 互高亮。
 */
export function pulseWorldTileIntelEtaResidualMutualHighlight(
  worldTileCard: HTMLElement | null | undefined,
  intelRoot: ParentNode | null | undefined,
  active: boolean,
  options?: PulseWorldTileIntelEtaResidualMutualHighlightOptions,
): void {
  const timers = options?.timers;
  if (timers?.ringTimer) {
    clearTimeout(timers.ringTimer);
    timers.ringTimer = null;
  }
  clearWorldTileIntelEtaResidualHighlight(worldTileCard, intelRoot);
  if (!active || !worldTileCard || !intelRoot) return;

  worldTileCard.classList.add(WORLD_TILE_INTEL_ETA_RESIDUAL_RING_CLASS);
  void worldTileCard.offsetWidth;
  intelRoot
    .querySelector<HTMLElement>(
      `[data-role="${MARCH_INTEL_ETA_RESIDUAL_COORD_ROLE}"].${MARCH_INTEL_ETA_RESIDUAL_COORD_CLASS}`,
    )
    ?.classList.add(MARCH_INTEL_ETA_RESIDUAL_COORD_HIGHLIGHT_CLASS);

  const duration = options?.durationMs ?? WORLD_TILE_INTEL_ETA_RESIDUAL_RING_MS;
  if (timers && duration > 0) {
    timers.ringTimer = setTimeout(() => {
      timers.ringTimer = null;
      clearWorldTileIntelEtaResidualHighlight(worldTileCard, intelRoot);
    }, duration);
  }
}

/** @internal vitest */
export function resetWorldTileIntelEtaResidualTimersForTests(
  timers: WorldTileIntelEtaResidualTimers,
): void {
  if (timers.ringTimer) {
    clearTimeout(timers.ringTimer);
    timers.ringTimer = null;
  }
}
