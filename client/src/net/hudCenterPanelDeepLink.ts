import {
  formatHudTodoMergedSweepLine,
  hudTodoMergedSweepSegments,
  resolveToolbarPanelFromHudTodo,
  type HudTodoMergedSweepCounts,
  type HudTodoMergedSweepFacet,
  type HudTodoMergedSweepSegment,
} from "@/net/hudTodoMergedSweep";

/** HUD 顶栏：邮件/日常/队列/社交四面板 tab 深链合并扫读（CLIENT-202；与 CLIENT-216 merged sweep 同源）。 */
export const HUD_CENTER_PANEL_DEEPLINK_LINE_ROLE = "hud-center-panel-deeplink-line";
export const HUD_CENTER_PANEL_DEEPLINK_FACET_ATTR = "data-hud-center-panel-facet";
/** CLIENT-209：与邮件面板 tab 扫读行共用的 HUD 深链刷新戳记（轮询/快照 bump）。 */
export const HUD_CENTER_PANEL_DEEPLINK_REFRESH_STAMP_ATTR = "data-hud-center-panel-deeplink-stamp";

export const CENTER_PANEL_TAB_PULSE_CLASS = "center-panel-tab-pulse";
export const CENTER_PANEL_TAB_PULSE_MS = 1500;

export type HudCenterPanelDeepLinkFacet = HudTodoMergedSweepFacet;

export type CenterPanelTabFromHudTodo = HudCenterPanelDeepLinkFacet;

export type HudCenterPanelDeepLinkCounts = HudTodoMergedSweepCounts;

export const HUD_CENTER_PANEL_TAB_PRIORITY: HudCenterPanelDeepLinkFacet[] = [
  "daily",
  "mail",
  "queue",
  "social",
];

export type HudCenterPanelDeepLinkSegment = HudTodoMergedSweepSegment;

/** 可点击分段：与 `formatHudTodoMergedSweepLine` 文案一致（CLIENT-216）。 */
export function hudCenterPanelDeepLinkSegments(
  counts: HudCenterPanelDeepLinkCounts,
): HudCenterPanelDeepLinkSegment[] {
  return hudTodoMergedSweepSegments(counts);
}

export function formatHudCenterPanelDeepLinkLine(counts: HudCenterPanelDeepLinkCounts): string | null {
  return formatHudTodoMergedSweepLine(counts);
}

/** 点击分段或默认优先级时解析应打开的中心面板 tab（无待办则 null）。 */
export function resolveCenterPanelTabFromHudTodo(
  facet: HudCenterPanelDeepLinkFacet,
  counts: HudCenterPanelDeepLinkCounts,
): CenterPanelTabFromHudTodo | null {
  return resolveToolbarPanelFromHudTodo(facet, counts);
}

export function pickDefaultCenterPanelTabFromHudTodo(
  counts: HudCenterPanelDeepLinkCounts,
): CenterPanelTabFromHudTodo | null {
  for (const facet of HUD_CENTER_PANEL_TAB_PRIORITY) {
    const tab = resolveCenterPanelTabFromHudTodo(facet, counts);
    if (tab) return tab;
  }
  return null;
}

export function centerPanelTabToolbarAction(tab: CenterPanelTabFromHudTodo): string {
  switch (tab) {
    case "mail":
      return "toggle-mail";
    case "daily":
      return "toggle-daily";
    case "queue":
      return "toggle-queue";
    case "social":
      return "toggle-chat";
    default:
      return "toggle-mail";
  }
}

export function scheduleCenterPanelTabPulse(el: HTMLElement | null | undefined): void {
  if (!el) return;
  el.classList.remove(CENTER_PANEL_TAB_PULSE_CLASS);
  void el.offsetWidth;
  el.classList.add(CENTER_PANEL_TAB_PULSE_CLASS);
  window.setTimeout(() => {
    el.classList.remove(CENTER_PANEL_TAB_PULSE_CLASS);
  }, CENTER_PANEL_TAB_PULSE_MS);
}
