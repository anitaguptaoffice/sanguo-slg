import {
  resetContentPanelScroll,
  resetGameViewportScroll,
} from "@/ui/queuePanelScroll";

/** Center / military roots that use `.panel-scroll-body` at layout-narrow (CLIENT-062 + CLIENT-070 + CLIENT-078 + CLIENT-095). */
export const NARROW_SCROLL_CENTER_PANEL_IDS = [
  "hero",
  "bag",
  "shop",
  "queue",
  "military",
  "mail",
  "daily",
  "world",
  "rank",
  "march",
  "battle-report",
  "guild",
  "chat",
] as const;

export type NarrowScrollCenterPanelId = (typeof NARROW_SCROLL_CENTER_PANEL_IDS)[number];

export function panelScrollBody(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>(".panel-scroll-body");
}

/** Reset letterbox viewport and panel list scroll (prefers `.panel-scroll-body`). */
export function resetCenterPanelViewportScroll(panel: HTMLElement): void {
  resetGameViewportScroll();
  const body = panelScrollBody(panel);
  if (body) resetContentPanelScroll(body);
  else resetContentPanelScroll(panel);
}
