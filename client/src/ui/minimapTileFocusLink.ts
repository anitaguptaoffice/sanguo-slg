import type { MarchSummary } from "@/net/militaryFormat";
import {
  computeMinimapViewFramingPoints,
  type MinimapView,
  type WorldBounds,
} from "@/ui/worldMinimap";

/** 格点信息卡 DOM 钩子（CLIENT-188；与 `data-role="world-tile-info"` 并存）。 */
export const WORLD_TILE_INFO_CARD_CLASS = "world-tile-info-card";

/** 信息卡「在小地图定位」反向 2s 高亮（CLIENT-139 互链不退化）。 */
export const MINIMAP_FOCUS_PULSE_CLASS = "minimap-focus-pulse";
export const MINIMAP_FOCUS_PULSE_MS = 2000;

/** 军情选中行军终点小地图叠加高亮（与 CLIENT-172 信息卡可叠加）。 */
export const MINIMAP_MARCH_END_HIGHLIGHT_CLASS = "minimap-march-end-highlight";
export const MINIMAP_MARCH_END_RING_COLOR = "#7ec8e3";

export type MinimapMarchEndHighlight = {
  wx: number;
  wy: number;
  marchId: number;
};

export type SyncMinimapFocusFromTileCardResult = {
  focusGrid: { wx: number; wy: number };
  view: MinimapView;
  focusPulseUntilMs: number;
};

/**
 * 世界格点信息卡点击居中：更新 focus 格、纳入视野，并启动 2s `minimap-focus-pulse` 窗口。
 */
export function syncMinimapFocusFromTileCard(
  grid: { x: number; y: number },
  bounds: WorldBounds,
  nowMs: number = Date.now(),
): SyncMinimapFocusFromTileCardResult {
  const focusGrid = { wx: grid.x, wy: grid.y };
  const view = computeMinimapViewFramingPoints(bounds, [focusGrid]);
  return {
    focusGrid,
    view,
    focusPulseUntilMs: nowMs + MINIMAP_FOCUS_PULSE_MS,
  };
}

/** 军情列表选中行军 → 小地图终点高亮状态（无坐标时返回 null）。 */
export function highlightMinimapMarchEnd(
  march: Pick<MarchSummary, "march_id" | "to_x" | "to_y"> | null | undefined,
): MinimapMarchEndHighlight | null {
  if (!march) return null;
  const tx = march.to_x;
  const ty = march.to_y;
  const id = march.march_id;
  if (!Number.isFinite(tx) || !Number.isFinite(ty) || id == null || id <= 0) {
    return null;
  }
  return { wx: Math.trunc(tx!), wy: Math.trunc(ty!), marchId: Math.trunc(id) };
}

export function isMinimapFocusPulseActive(focusPulseUntilMs: number, nowMs: number): boolean {
  return focusPulseUntilMs > nowMs;
}

let minimapFocusPulseTimer: ReturnType<typeof setTimeout> | null = null;

/** 为 `#layout-frame` 附加 2s `minimap-focus-pulse`（可重复触发）。 */
export function applyMinimapFocusPulseClass(
  layoutFrame: HTMLElement | null | undefined,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): void {
  if (!layoutFrame) return;
  layoutFrame.classList.remove(MINIMAP_FOCUS_PULSE_CLASS);
  void layoutFrame.offsetWidth;
  layoutFrame.classList.add(MINIMAP_FOCUS_PULSE_CLASS);
  if (minimapFocusPulseTimer != null) {
    clearTimeout(minimapFocusPulseTimer);
  }
  minimapFocusPulseTimer = windowObj.setTimeout(() => {
    layoutFrame.classList.remove(MINIMAP_FOCUS_PULSE_CLASS);
    minimapFocusPulseTimer = null;
  }, MINIMAP_FOCUS_PULSE_MS);
}

/** @internal vitest：清理挂起的脉冲定时器。 */
export function resetMinimapFocusPulseTimerForTests(): void {
  if (minimapFocusPulseTimer != null) {
    clearTimeout(minimapFocusPulseTimer);
    minimapFocusPulseTimer = null;
  }
}
