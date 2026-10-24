import { gridCellsMatch } from "@/ui/marchWorldListLink";

export const WORLD_TILE_FOCUS_PULSE_CLASS = "world-tile-focus-pulse";
export const WORLD_TILE_FOCUS_PULSE_MS = 2000;

export type WorldTileGridSelectionSource = "world_list" | "minimap" | "external";

/** 小地图选点应触发信息卡焦点脉冲（CLIENT-170）。 */
export function shouldPulseWorldTileFocusOnSelect(
  source: WorldTileGridSelectionSource | undefined,
): boolean {
  return source === "minimap";
}

/** 小地图反算格点与世界面板选中格对齐（纯函数，供单测）。 */
export function worldTileGridMatchesMinimapPick(
  selected: { x: number; y: number } | null | undefined,
  pick: { wx: number; wy: number } | null | undefined,
): boolean {
  if (!selected || !pick) return false;
  return gridCellsMatch(selected.x, selected.y, pick.wx, pick.wy);
}

let focusPulseTimer: ReturnType<typeof setTimeout> | null = null;

/** 为格点信息卡附加 2s `world-tile-focus-pulse`（可重复触发）。 */
export function applyWorldTileFocusPulse(
  card: HTMLElement | null | undefined,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): void {
  if (!card) return;
  card.classList.remove(WORLD_TILE_FOCUS_PULSE_CLASS);
  void card.offsetWidth;
  card.classList.add(WORLD_TILE_FOCUS_PULSE_CLASS);
  if (focusPulseTimer != null) {
    clearTimeout(focusPulseTimer);
  }
  focusPulseTimer = windowObj.setTimeout(() => {
    card.classList.remove(WORLD_TILE_FOCUS_PULSE_CLASS);
    focusPulseTimer = null;
  }, WORLD_TILE_FOCUS_PULSE_MS);
}

/** @internal vitest：清理挂起的脉冲定时器。 */
export function resetWorldTileFocusPulseTimerForTests(): void {
  if (focusPulseTimer != null) {
    clearTimeout(focusPulseTimer);
    focusPulseTimer = null;
  }
}
