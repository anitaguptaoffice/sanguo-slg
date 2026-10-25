/** CLIENT-304：自排行/军情返回时分类 tab/chip **巩固再加深一层** 高亮（2.5s；CLIENT-288 **并存**）。 */
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_CLASS =
  "panel-return-source-highlight-residual-deepest";
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_MS = 2500;

let returnSourceHighlightDeepestTimer: ReturnType<typeof setTimeout> | null = null;

export function clearPanelReturnSourceHighlightResidualDeepest(
  panelRoot: ParentNode | null | undefined,
): void {
  if (!panelRoot) return;
  panelRoot
    .querySelectorAll<HTMLElement>(`.${PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_CLASS}`)
    .forEach((el) => el.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_CLASS));
}

/** 分类 tab/chip 附加 `panel-return-source-highlight-residual-deepest` 2.5s。 */
export function highlightPanelReturnSourceCategoryResidualDeepest(
  tab: HTMLElement | null | undefined,
  panelRoot: ParentNode | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_MS,
): boolean {
  if (!tab) return false;
  clearPanelReturnSourceHighlightResidualDeepest(panelRoot);
  if (returnSourceHighlightDeepestTimer != null) {
    windowObj.clearTimeout(returnSourceHighlightDeepestTimer);
    returnSourceHighlightDeepestTimer = null;
  }
  tab.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_CLASS);
  void tab.offsetWidth;
  tab.classList.add(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_CLASS);
  returnSourceHighlightDeepestTimer = windowObj.setTimeout(() => {
    tab.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_CLASS);
    returnSourceHighlightDeepestTimer = null;
  }, durationMs);
  return true;
}

/** @internal vitest */
export function resetPanelReturnSourceHighlightResidualDeepestTimersForTests(): void {
  if (returnSourceHighlightDeepestTimer != null) {
    clearTimeout(returnSourceHighlightDeepestTimer);
    returnSourceHighlightDeepestTimer = null;
  }
}
