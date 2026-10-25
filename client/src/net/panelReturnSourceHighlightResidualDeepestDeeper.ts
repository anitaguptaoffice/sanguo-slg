/** CLIENT-320：自排行/军情返回时分类 tab/chip **巩固再加深二层** 高亮（2.5s；CLIENT-304 **并存**）。 */
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPER_CLASS =
  "panel-return-source-highlight-residual-deepest-deeper";
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPER_MS = 2500;

let returnSourceHighlightDeepestDeeperTimer: ReturnType<typeof setTimeout> | null = null;

export function clearPanelReturnSourceHighlightResidualDeepestDeeper(
  panelRoot: ParentNode | null | undefined,
): void {
  if (!panelRoot) return;
  panelRoot
    .querySelectorAll<HTMLElement>(`.${PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPER_CLASS}`)
    .forEach((el) => el.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPER_CLASS));
}

/** 分类 tab/chip 附加 `panel-return-source-highlight-residual-deepest-deeper` 2.5s。 */
export function highlightPanelReturnSourceCategoryResidualDeepestDeeper(
  tab: HTMLElement | null | undefined,
  panelRoot: ParentNode | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPER_MS,
): boolean {
  if (!tab) return false;
  clearPanelReturnSourceHighlightResidualDeepestDeeper(panelRoot);
  if (returnSourceHighlightDeepestDeeperTimer != null) {
    windowObj.clearTimeout(returnSourceHighlightDeepestDeeperTimer);
    returnSourceHighlightDeepestDeeperTimer = null;
  }
  tab.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPER_CLASS);
  void tab.offsetWidth;
  tab.classList.add(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPER_CLASS);
  returnSourceHighlightDeepestDeeperTimer = windowObj.setTimeout(() => {
    tab.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPER_CLASS);
    returnSourceHighlightDeepestDeeperTimer = null;
  }, durationMs);
  return true;
}

/** @internal vitest */
export function resetPanelReturnSourceHighlightResidualDeepestDeeperTimersForTests(): void {
  if (returnSourceHighlightDeepestDeeperTimer != null) {
    clearTimeout(returnSourceHighlightDeepestDeeperTimer);
    returnSourceHighlightDeepestDeeperTimer = null;
  }
}
