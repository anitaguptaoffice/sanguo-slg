/** CLIENT-191 / CLIENT-140：战报坐标复盘时小地图区域 DOM 脉冲（canvas 高亮互补）。 */
export const MINIMAP_BATTLE_REPLAY_PULSE_CLASS = "minimap-battle-replay-pulse";
export const MINIMAP_BATTLE_REPLAY_PULSE_MS = 2000;

let pulseTimer: ReturnType<typeof setTimeout> | null = null;

export function applyMinimapBattleReplayPulse(
  root: HTMLElement | null | undefined,
  windowObj: Pick<Window, "setTimeout"> = globalThis.window,
): void {
  if (!root) return;
  root.classList.remove(MINIMAP_BATTLE_REPLAY_PULSE_CLASS);
  void root.offsetWidth;
  root.classList.add(MINIMAP_BATTLE_REPLAY_PULSE_CLASS);
  if (pulseTimer != null) clearTimeout(pulseTimer);
  pulseTimer = windowObj.setTimeout(() => {
    root.classList.remove(MINIMAP_BATTLE_REPLAY_PULSE_CLASS);
    pulseTimer = null;
  }, MINIMAP_BATTLE_REPLAY_PULSE_MS);
}

/** @internal vitest */
export function resetMinimapBattleReplayPulseTimerForTests(): void {
  if (pulseTimer != null) {
    clearTimeout(pulseTimer);
    pulseTimer = null;
  }
}
