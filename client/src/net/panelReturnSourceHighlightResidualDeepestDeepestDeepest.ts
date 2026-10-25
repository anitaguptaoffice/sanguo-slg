/** CLIENT-352：自排行/军情返回时分类 tab/chip **巩固再加深四层** 高亮（2.5s；CLIENT-336 **并存**）。窄屏 manifest 导出软依赖 **CLIENT-355**。 */
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_CLASS =
  "panel-return-source-highlight-residual-deepest-deepest-deepest";
export const PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_MS = 2500;

let returnSourceHighlightDeepestDeepestDeepestTimer: ReturnType<typeof setTimeout> | null = null;

export function clearPanelReturnSourceHighlightResidualDeepestDeepestDeepest(
  panelRoot: ParentNode | null | undefined,
): void {
  if (!panelRoot) return;
  panelRoot
    .querySelectorAll<HTMLElement>(
      `.${PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_CLASS}`,
    )
    .forEach((el) =>
      el.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_CLASS),
    );
}

/** 分类 tab/chip 附加 `panel-return-source-highlight-residual-deepest-deepest-deepest` 2.5s。 */
export function highlightPanelReturnSourceCategoryResidualDeepestDeepestDeepest(
  tab: HTMLElement | null | undefined,
  panelRoot: ParentNode | null | undefined,
  windowObj: Pick<Window, "setTimeout" | "clearTimeout"> = globalThis.window,
  durationMs: number = PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_MS,
): boolean {
  if (!tab) return false;
  clearPanelReturnSourceHighlightResidualDeepestDeepestDeepest(panelRoot);
  if (returnSourceHighlightDeepestDeepestDeepestTimer != null) {
    windowObj.clearTimeout(returnSourceHighlightDeepestDeepestDeepestTimer);
    returnSourceHighlightDeepestDeepestDeepestTimer = null;
  }
  tab.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_CLASS);
  void tab.offsetWidth;
  tab.classList.add(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_CLASS);
  returnSourceHighlightDeepestDeepestDeepestTimer = windowObj.setTimeout(() => {
    tab.classList.remove(PANEL_RETURN_SOURCE_HIGHLIGHT_RESIDUAL_DEEPEST_DEEPEST_DEEPEST_CLASS);
    returnSourceHighlightDeepestDeepestDeepestTimer = null;
  }, durationMs);
  return true;
}

/** @internal vitest */
export function resetPanelReturnSourceHighlightResidualDeepestDeepestDeepestTimersForTests(): void {
  if (returnSourceHighlightDeepestDeepestDeepestTimer != null) {
    clearTimeout(returnSourceHighlightDeepestDeepestDeepestTimer);
    returnSourceHighlightDeepestDeepestDeepestTimer = null;
  }
}
