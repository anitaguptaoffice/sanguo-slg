/** Reset scroll on #game-viewport (focus/scroll-into-view can offset the letterboxed frame). */
export function resetGameViewportScroll(): void {
  const vp = document.getElementById("game-viewport");
  if (!vp) return;
  vp.scrollTop = 0;
  vp.scrollLeft = 0;
}

/** Reset scroll on a center content panel so title / top border stay visible (CLIENT-064 evidence + UX). */
export function resetContentPanelScroll(root: HTMLElement): void {
  root.scrollTop = 0;
  root.scrollLeft = 0;
}

/** Panel open helper: viewport + panel scroll at origin. */
export function resetQueuePanelViewportScroll(panel: HTMLElement): void {
  resetGameViewportScroll();
  resetContentPanelScroll(panel);
}
