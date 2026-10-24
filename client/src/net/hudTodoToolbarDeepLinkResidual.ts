import {
  scheduleToolbarPanelDeepLinkPulse,
  TOOLBAR_PANEL_DEEP_LINK_PULSE_MS,
} from "@/net/hudTodoMergedSweep";

/** CLIENT-250：HUD 待办角标/合并行深链打开底栏时的残余脉冲（与 CLIENT-216 主脉冲并存）。 */
export const HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_CLASS =
  "hud-todo-toolbar-deep-link-residual-pulse";
export const HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_MS = TOOLBAR_PANEL_DEEP_LINK_PULSE_MS;

/** CLIENT-266：CLIENT-250 残余脉冲上的 2s 深脉冲（与 CLIENT-241 角标同步 **并存**）。 */
export const HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS =
  "hud-todo-toolbar-deep-link-residual-deep-pulse";
export const HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_MS = 2000;

export function scheduleHudTodoToolbarDeepLinkResidualPulse(
  el: HTMLElement | null | undefined,
): void {
  if (!el) return;
  el.classList.remove(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_CLASS);
  void el.offsetWidth;
  el.classList.add(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_CLASS);
  window.setTimeout(() => {
    el.classList.remove(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_CLASS);
  }, HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_PULSE_MS);
}

export function scheduleHudTodoToolbarDeepLinkResidualDeepPulse(
  el: HTMLElement | null | undefined,
): void {
  if (!el) return;
  el.classList.remove(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS);
  void el.offsetWidth;
  el.classList.add(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS);
  window.setTimeout(() => {
    el.classList.remove(HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_CLASS);
  }, HUD_TODO_TOOLBAR_DEEP_LINK_RESIDUAL_DEEP_PULSE_MS);
}

/** 打开底栏面板：CLIENT-216 主脉冲 + CLIENT-250 残余环 + CLIENT-266 深脉冲。 */
export function pulseHudTodoToolbarDeepLinkResidual(el: HTMLElement | null | undefined): void {
  scheduleToolbarPanelDeepLinkPulse(el);
  scheduleHudTodoToolbarDeepLinkResidualPulse(el);
  scheduleHudTodoToolbarDeepLinkResidualDeepPulse(el);
}
